import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import {
  acquireClusterLock,
  releaseClusterLock,
  renewClusterLock,
  acquireRedlockConsensus,
  releaseRedlockConsensus,
  renewRedlockConsensus,
} from "./cluster-lock.js";

export interface LeaderElectionOptions {
  /**
   * Primary Redis client (standalone node or Redis Cluster).
   * Either `client` or `redlockClients` must be provided.
   */
  client?: Redis;
  /**
   * Array of N independent Redis master clients for Redlock majority-quorum consensus.
   */
  redlockClients?: Redis[];
  /**
   * The unique distributed lock key namespace (e.g. "order:outbox:sweeper:leader").
   */
  lockKey: string;
  /**
   * Unique candidate ID identifying this process, pod, or container instance.
   */
  candidateId: string;
  /**
   * Lease TTL in milliseconds before the leader lease automatically expires (default: 10,000ms).
   */
  leaseTtlMs?: number;
  /**
   * Heartbeat renewal interval in milliseconds for the elected leader (default: leaseTtlMs / 3, e.g. 3,333ms).
   */
  heartbeatIntervalMs?: number;
  /**
   * Retry delay in milliseconds for standby / follower replicas (default: 2,000ms).
   */
  retryDelayMs?: number;
  /**
   * Optional custom fencing token key in Redis (default: `${lockKey}:fencing_token`).
   */
  fencingTokenKey?: string;
  /**
   * Maximum allowed clock drift or event-loop stall in milliseconds before the leader
   * considers its lease invalid and self-fences to prevent split-brain execution.
   * Defaults to Math.floor(leaseTtlMs * 0.6) (e.g. 6,000ms for 10s lease).
   */
  maxClockDriftMs?: number;
  /**
   * Optional callback invoked immediately when this replica is elected cluster leader.
   */
  onPromoted?: (fencingToken?: number) => void | Promise<void>;
  /**
   * Optional callback invoked immediately when this replica loses leadership or steps down.
   */
  onDemoted?: () => void | Promise<void>;
  /**
   * Optional error handler for background election and heartbeat exceptions.
   */
  onError?: (error: Error) => void;
}

export interface LeaderInfo {
  isLeader: boolean;
  leaderId: string | null;
  fencingToken: number;
  isLeadershipValid: boolean;
  lastHeartbeatAgeMs: number;
}

/**
 * Thrown when a leader attempts to execute or verify operations after its heartbeat
 * has drifted or its lease has been invalidated, protecting backend state from split-brain writes.
 */
export class LeaderFencingError extends Error {
  public readonly candidateId: string;
  public readonly lastHeartbeatAgeMs: number;
  public readonly maxAllowedDriftMs: number;

  constructor(
    message: string,
    candidateId: string,
    lastHeartbeatAgeMs: number,
    maxAllowedDriftMs: number,
  ) {
    super(message);
    this.name = "LeaderFencingError";
    this.candidateId = candidateId;
    this.lastHeartbeatAgeMs = lastHeartbeatAgeMs;
    this.maxAllowedDriftMs = maxAllowedDriftMs;
    Object.setPrototypeOf(this, LeaderFencingError.prototype);
  }
}

/**
 * Distributed Leader Election framework for cluster singletons and background sweepers.
 *
 * Guarantees that across horizontally scaled microservice replicas:
 * 1. Exactly ONE replica acts as the active Leader executing background routines (such as outbox sweepers).
 * 2. Follower replicas remain in standby mode, eliminating duplicate database cursor scans and duplicate Kafka dispatches.
 * 3. The Leader automatically heartbeats and renews its lease before expiration via atomic Lua scripts.
 * 4. If the active Leader crashes or disconnects, the lease expires and an active standby replica is promoted automatically.
 * 5. Supports both single-client Redis/Cluster setups and multi-node Redlock consensus clusters.
 */
export class DistributedLeaderElector extends EventEmitter {
  private readonly client?: Redis;
  private readonly redlockClients?: Redis[];
  readonly lockKey: string;
  readonly candidateId: string;
  readonly leaseTtlMs: number;
  readonly heartbeatIntervalMs: number;
  readonly retryDelayMs: number;
  readonly fencingTokenKey: string;
  readonly maxClockDriftMs: number;

  private onPromotedCallback?: (fencingToken?: number) => void | Promise<void>;
  private onDemotedCallback?: () => void | Promise<void>;
  private onErrorCallback?: (error: Error) => void;

  private _isLeader = false;
  private _fencingToken = 0;
  private _lastHeartbeatSuccess = 0;
  private _running = false;
  private timer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private inFlightTick = false;

  constructor(options: LeaderElectionOptions) {
    super();

    if (
      !options.client &&
      (!options.redlockClients || options.redlockClients.length === 0)
    ) {
      throw new Error(
        "LeaderElection requires either a 'client' (Redis) or 'redlockClients' (Redis[]) option.",
      );
    }

    this.client = options.client;
    this.redlockClients = options.redlockClients;
    this.lockKey = options.lockKey;
    this.candidateId = options.candidateId;

    this.leaseTtlMs = options.leaseTtlMs ?? 10_000;
    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ??
      Math.max(1000, Math.floor(this.leaseTtlMs / 3));
    this.retryDelayMs = options.retryDelayMs ?? 2_000;
    this.fencingTokenKey =
      options.fencingTokenKey ?? `${this.lockKey}:fencing_token`;
    this.maxClockDriftMs =
      options.maxClockDriftMs ?? Math.floor(this.leaseTtlMs * 0.6);

    this.onPromotedCallback = options.onPromoted;
    this.onDemotedCallback = options.onDemoted;
    this.onErrorCallback = options.onError;
  }

  /**
   * Fast in-memory check to verify if this node is currently the cluster leader.
   */
  get isCurrentLeader(): boolean {
    return this._isLeader;
  }

  /**
   * Monotonically increasing fencing counter assigned upon election.
   * Prevents stale leaders from executing writes after losing their lease.
   */
  get fencingToken(): number {
    return this._fencingToken;
  }

  /**
   * Elapsed time in milliseconds since the last confirmed successful Redis heartbeat renewal.
   */
  get lastHeartbeatAgeMs(): number {
    return this._lastHeartbeatSuccess > 0
      ? Date.now() - this._lastHeartbeatSuccess
      : Infinity;
  }

  /**
   * Verifies that this node is leader AND that its heartbeat has not drifted
   * beyond the maxClockDriftMs safety margin.
   */
  get isLeadershipValid(): boolean {
    if (!this._isLeader || this._fencingToken <= 0) {
      return false;
    }
    return this.lastHeartbeatAgeMs <= this.maxClockDriftMs;
  }

  /**
   * Defensive assertion: guarantees this node is valid leader and within heartbeat drift bounds.
   * Returns the current monotonically increasing fencing token.
   * Throws LeaderFencingError if lease has expired or drifted.
   */
  assertLeadershipValid(): number {
    if (!this._isLeader || this._fencingToken <= 0) {
      throw new LeaderFencingError(
        `Node ${this.candidateId} is not the active cluster leader`,
        this.candidateId,
        this.lastHeartbeatAgeMs,
        this.maxClockDriftMs,
      );
    }
    const age = this.lastHeartbeatAgeMs;
    if (age > this.maxClockDriftMs) {
      void this.handleDemotion(
        `Heartbeat drift exceeded safety margin (${age}ms > ${this.maxClockDriftMs}ms)`,
      );
      throw new LeaderFencingError(
        `Heartbeat drift exceeded safety margin (${age}ms > ${this.maxClockDriftMs}ms). Self-fenced to prevent split-brain.`,
        this.candidateId,
        age,
        this.maxClockDriftMs,
      );
    }
    return this._fencingToken;
  }

  /**
   * Whether the background election and heartbeat loop is active.
   */
  get isRunning(): boolean {
    return this._running;
  }

  /**
   * Starts the background leader election and heartbeat loop.
   * Performs an immediate election attempt synchronously or as the first tick.
   */
  async start(): Promise<void> {
    if (this._running) {
      return;
    }
    this._running = true;
    await this.tick();
  }

  /**
   * Stops the leader elector, cancels pending heartbeat/retry timers,
   * and voluntarily resigns leadership if currently holding the lease.
   */
  async stop(): Promise<void> {
    this._running = false;
    this.stopHeartbeatLoop();
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this._isLeader) {
      await this.resign();
    }
  }

  /**
   * Voluntarily steps down as cluster leader and safely deletes the Redis lock,
   * allowing another waiting replica to take over immediately.
   */
  async resign(): Promise<void> {
    if (!this._isLeader) {
      return;
    }

    this.stopHeartbeatLoop();
    try {
      await this.releaseLease();
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      await this.handleDemotion("Voluntary resignation");
    }
  }

  /**
   * Manually attempts an immediate election or lease renewal outside the loop.
   */
  async electNow(): Promise<boolean> {
    if (this._isLeader) {
      const renewed = await this.renewLease();
      if (!renewed) {
        await this.handleDemotion("Manual renewal failed");
        return false;
      }
      this._lastHeartbeatSuccess = Date.now();
      return true;
    }

    const won = await this.attemptAcquisition();
    if (won) {
      await this.handlePromotion();
      return true;
    }
    return false;
  }

  /**
   * Queries Redis directly to check who currently holds the cluster leader lease.
   */
  async getCurrentLeaderId(): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(this.lockKey);
      } catch {
        return null;
      }
    }

    if (this.redlockClients && this.redlockClients.length > 0) {
      const results = await Promise.allSettled(
        this.redlockClients.map((c) => c.get(this.lockKey)),
      );
      for (const res of results) {
        if (res.status === "fulfilled" && res.value) {
          return res.value;
        }
      }
    }

    return null;
  }

  /**
   * Returns complete leader information (including fencing token and heartbeat drift safety).
   */
  async getLeaderInfo(): Promise<LeaderInfo> {
    const leaderId = await this.getCurrentLeaderId();
    const isLeader = this._isLeader && leaderId === this.candidateId;
    return {
      isLeader,
      leaderId,
      fencingToken: isLeader ? this._fencingToken : 0,
      isLeadershipValid: isLeader && this.isLeadershipValid,
      lastHeartbeatAgeMs: this.lastHeartbeatAgeMs,
    };
  }

  /**
   * Single election/heartbeat tick in the continuous election lifecycle.
   */
  private async tick(): Promise<void> {
    if (!this._running || this.inFlightTick) {
      return;
    }

    this.inFlightTick = true;
    let nextDelay = this.retryDelayMs;

    try {
      if (this._isLeader) {
        // LEADER MODE: Check for event-loop stall / heartbeat drift
        if (!this.isLeadershipValid) {
          await this.handleDemotion("Heartbeat drift exceeded safety margin");
          nextDelay = this.calculateFollowerDelay();
        } else {
          nextDelay = this.heartbeatIntervalMs;
        }
      } else {
        // FOLLOWER / STANDBY MODE: Attempt to acquire leadership
        const won = await this.attemptAcquisition();
        if (won) {
          await this.handlePromotion();
          nextDelay = this.heartbeatIntervalMs;
        } else {
          nextDelay = this.calculateFollowerDelay();
        }
      }
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)));
      if (this._isLeader) {
        await this.handleDemotion("Heartbeat error encountered");
      }
      nextDelay = this.calculateFollowerDelay();
    } finally {
      this.inFlightTick = false;
      if (this._running) {
        this.timer = setTimeout(() => {
          void this.tick();
        }, nextDelay);
      }
    }
  }

  private async attemptAcquisition(): Promise<boolean> {
    if (this.redlockClients && this.redlockClients.length > 0) {
      const lease = await acquireRedlockConsensus(
        this.redlockClients,
        this.lockKey,
        this.candidateId,
        { ttlMs: this.leaseTtlMs },
      );
      return lease !== null;
    }

    if (this.client) {
      return await acquireClusterLock(
        this.client,
        this.lockKey,
        this.candidateId,
        {
          ttlMs: this.leaseTtlMs,
        },
      );
    }

    return false;
  }

  private async renewLease(): Promise<boolean> {
    if (this.redlockClients && this.redlockClients.length > 0) {
      return await renewRedlockConsensus(
        this.redlockClients,
        this.lockKey,
        this.candidateId,
        this.leaseTtlMs,
      );
    }

    if (this.client) {
      return await renewClusterLock(
        this.client,
        this.lockKey,
        this.candidateId,
        this.leaseTtlMs,
      );
    }

    return false;
  }

  private async releaseLease(): Promise<boolean> {
    if (this.redlockClients && this.redlockClients.length > 0) {
      return await releaseRedlockConsensus(
        this.redlockClients,
        this.lockKey,
        this.candidateId,
      );
    }

    if (this.client) {
      return await releaseClusterLock(
        this.client,
        this.lockKey,
        this.candidateId,
      );
    }

    return false;
  }

  /**
   * Atomically increments the cluster-wide fencing counter in Redis upon winning leadership.
   */
  private async incrementFencingToken(): Promise<number> {
    try {
      if (this.client && typeof this.client.incr === "function") {
        return await this.client.incr(this.fencingTokenKey);
      }
      if (this.redlockClients && this.redlockClients.length > 0) {
        const primary = this.redlockClients[0]!;
        if (typeof primary.incr === "function") {
          return await primary.incr(this.fencingTokenKey);
        }
      }
    } catch (err) {
      this.handleError(err instanceof Error ? err : new Error(String(err)));
    }
    return Date.now();
  }

  /**
   * Starts a decoupled, high-priority asynchronous background heartbeat loop.
   * Runs independently of any application processing or sweeper loops.
   */
  private startHeartbeatLoop(): void {
    this.stopHeartbeatLoop();
    this.heartbeatTimer = setInterval(async () => {
      if (!this._running || !this._isLeader) {
        this.stopHeartbeatLoop();
        return;
      }
      try {
        const renewed = await this.renewLease();
        if (renewed) {
          this._lastHeartbeatSuccess = Date.now();
        } else {
          this.stopHeartbeatLoop();
          await this.handleDemotion("Lease renewal rejected by Redis cluster");
        }
      } catch (err) {
        this.handleError(err instanceof Error ? err : new Error(String(err)));
        this.stopHeartbeatLoop();
        await this.handleDemotion("Lease renewal network failure");
      }
    }, this.heartbeatIntervalMs);

    if (typeof this.heartbeatTimer.unref === "function") {
      this.heartbeatTimer.unref();
    }
  }

  private stopHeartbeatLoop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async handlePromotion(): Promise<void> {
    if (this._isLeader) {
      return;
    }
    this._isLeader = true;
    this._lastHeartbeatSuccess = Date.now();
    try {
      this._fencingToken = await this.incrementFencingToken();
    } catch {
      this._fencingToken = Date.now();
    }
    this.startHeartbeatLoop();
    this.emit("promoted", this.candidateId, this._fencingToken);

    if (this.onPromotedCallback) {
      try {
        await this.onPromotedCallback(this._fencingToken);
      } catch (err) {
        this.handleError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private async handleDemotion(reason?: string): Promise<void> {
    if (!this._isLeader) {
      return;
    }
    this.stopHeartbeatLoop();
    const lastToken = this._fencingToken;
    this._isLeader = false;
    this._fencingToken = 0;
    this.emit("demoted", {
      candidateId: this.candidateId,
      reason,
      lastFencingToken: lastToken,
    });

    if (this.onDemotedCallback) {
      try {
        await this.onDemotedCallback();
      } catch (err) {
        this.handleError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private calculateFollowerDelay(): number {
    // Add ±15% jitter to prevent thundering herd when lock expires
    const jitter =
      Math.floor(Math.random() * (this.retryDelayMs * 0.3)) -
      this.retryDelayMs * 0.15;
    return Math.max(500, Math.floor(this.retryDelayMs + jitter));
  }

  private handleError(error: Error): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
    if (this.listenerCount("error") > 0) {
      this.emit("error", error);
    }
  }
}

export { DistributedLeaderElector as LeaderElection };
