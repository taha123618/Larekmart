import { redis } from "../utils/redis.js";
import { env } from "../config/env.js";
import type { ShippingRate, TrackingResult } from "@repo/types";

export class ShippingCache {
  private static rateKey(
    city: string,
    country: string,
    weight: number,
    isCod: boolean = false,
    codAmount: number = 0,
  ): string {
    return `rates:${country.toLowerCase()}:${city.toLowerCase().trim()}:${weight.toFixed(1)}:cod:${isCod ? 1 : 0}:${codAmount}`;
  }

  private static trackingKey(trackingNumber: string): string {
    return `tracking:${trackingNumber.toUpperCase().trim()}`;
  }

  private static webhookIdempotencyKey(
    carrier: string,
    eventId: string,
  ): string {
    return `webhook:idemp:${carrier.toLowerCase()}:${eventId}`;
  }

  private static webhookLeaseKey(carrier: string, eventId: string): string {
    return `webhook:lease:${carrier.toLowerCase()}:${eventId}`;
  }

  static async acquireWebhookLease(
    carrier: string,
    eventId: string,
    ttlMs: number = 15000,
  ): Promise<boolean> {
    const key = this.webhookLeaseKey(carrier, eventId);
    try {
      const res = await redis.client.set(key, "in_flight", "PX", ttlMs, "NX");
      return res === "OK";
    } catch {
      // Degrade gracefully if Redis is unavailable
      return true;
    }
  }

  static async releaseWebhookLease(
    carrier: string,
    eventId: string,
  ): Promise<void> {
    const key = this.webhookLeaseKey(carrier, eventId);
    try {
      await redis.client.del(key);
    } catch {
      // ignore
    }
  }

  static async getCachedRates(
    city: string,
    country: string,
    weight: number,
    isCod: boolean = false,
    codAmount: number = 0,
  ): Promise<ShippingRate[] | null> {
    const key = this.rateKey(city, country, weight, isCod, codAmount);
    const raw = await redis.client.get(key);
    return raw ? (JSON.parse(raw) as ShippingRate[]) : null;
  }

  static async setCachedRates(
    city: string,
    country: string,
    weight: number,
    rates: ShippingRate[],
    isCod: boolean = false,
    codAmount: number = 0,
  ): Promise<void> {
    const key = this.rateKey(city, country, weight, isCod, codAmount);
    await redis.client.set(
      key,
      JSON.stringify(rates),
      "EX",
      env.SHIPPING_RATE_CACHE_TTL_SECONDS,
    );
  }

  static async getCachedTracking(
    trackingNumber: string,
  ): Promise<TrackingResult | null> {
    const key = this.trackingKey(trackingNumber);
    const raw = await redis.client.get(key);
    return raw ? (JSON.parse(raw) as TrackingResult) : null;
  }

  static async setCachedTracking(
    trackingNumber: string,
    result: TrackingResult,
  ): Promise<void> {
    const key = this.trackingKey(trackingNumber);
    await redis.client.set(
      key,
      JSON.stringify(result),
      "EX",
      env.TRACKING_CACHE_TTL_SECONDS,
    );
  }

  static async invalidateTracking(trackingNumber: string): Promise<void> {
    const key = this.trackingKey(trackingNumber);
    await redis.client.del(key);
  }

  static async isWebhookProcessed(
    carrier: string,
    eventId: string,
  ): Promise<boolean> {
    const key = this.webhookIdempotencyKey(carrier, eventId);
    const exists = await redis.client.exists(key);
    return exists > 0;
  }

  static async markWebhookProcessed(
    carrier: string,
    eventId: string,
    ttlSeconds = 86400, // 24 hours
  ): Promise<void> {
    const key = this.webhookIdempotencyKey(carrier, eventId);
    await redis.client.set(key, "1", "EX", ttlSeconds);
  }
}
