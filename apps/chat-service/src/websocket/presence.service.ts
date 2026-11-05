import { getRedisClient } from "../middleware/idempotency.middleware.js";

export class PresenceService {
  private static PRESENCE_KEY_PREFIX = "chat:presence:";
  private static ONLINE_USERS_SET = "chat:online_users";
  private static PRESENCE_TTL_SECONDS = 60; // Auto-expire after 60s without heartbeat

  /**
   * Sets user online and refreshes heartbeat.
   */
  static async setUserOnline(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = new Date().toISOString();
      await redis.set(
        `${this.PRESENCE_KEY_PREFIX}${userId}`,
        JSON.stringify({ status: "ONLINE", lastSeenAt: timestamp }),
        "EX",
        this.PRESENCE_TTL_SECONDS,
      );
      await redis.sadd(this.ONLINE_USERS_SET, userId);
    } catch (err) {
      console.warn("[PresenceService] Redis error:", err);
    }
  }

  /**
   * Sets user offline explicitly.
   */
  static async setUserOffline(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const timestamp = new Date().toISOString();
      await redis.set(
        `${this.PRESENCE_KEY_PREFIX}${userId}`,
        JSON.stringify({ status: "OFFLINE", lastSeenAt: timestamp }),
        "EX",
        86400 * 7, // Retain last-seen for 7 days
      );
      await redis.srem(this.ONLINE_USERS_SET, userId);
    } catch (err) {
      console.warn("[PresenceService] Redis error:", err);
    }
  }

  /**
   * Fetches presence status for a given user.
   */
  static async getUserPresence(userId: string): Promise<{
    status: "ONLINE" | "OFFLINE" | "AWAY";
    lastSeenAt: string;
  }> {
    try {
      const redis = getRedisClient();
      const data = await redis.get(`${this.PRESENCE_KEY_PREFIX}${userId}`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (err) {
      console.warn("[PresenceService] Redis error:", err);
    }
    return { status: "OFFLINE", lastSeenAt: new Date(0).toISOString() };
  }

  /**
   * Batch checks online status for multiple user IDs.
   */
  static async getOnlineUsers(userIds: string[]): Promise<Set<string>> {
    const onlineSet = new Set<string>();
    if (userIds.length === 0) return onlineSet;

    try {
      const redis = getRedisClient();
      const isMembers = await Promise.all(
        userIds.map((uid) => redis.sismember(this.ONLINE_USERS_SET, uid)),
      );
      userIds.forEach((uid, index) => {
        if (isMembers[index] === 1) {
          onlineSet.add(uid);
        }
      });
    } catch (err) {
      console.warn("[PresenceService] Redis error:", err);
    }
    return onlineSet;
  }
}
