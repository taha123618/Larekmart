import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { systemSettings } from "../db/schema.js";
import { cacheService } from "./cache.service.js";
import type { SystemSettings } from "@repo/types";

const SETTINGS_ID = "marketplace";
const CACHE_KEY = "marketplace:system_settings";
const CACHE_TTL_SECONDS = 60;

export class SettingsService {
  /**
   * Retrieves current project-wide marketplace system settings.
   * Leverages Redis caching with automatic database initialization if not found.
   */
  public async getSystemSettings(): Promise<SystemSettings> {
    try {
      const redis = cacheService.getRedis();
      const cached = await redis.client.get(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as SystemSettings;
      }
    } catch {
      // Redis fallback to database query
    }

    try {
      const rows = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.id, SETTINGS_ID))
        .limit(1);

      if (rows.length > 0 && rows[0]) {
        const row = rows[0];
        const res: SystemSettings = {
          id: row.id,
          isSellerEnabled: row.isSellerEnabled,
          updatedAt: row.updatedAt.toISOString(),
          updatedBy: row.updatedBy ?? null,
        };
        await this.cacheSettings(res);
        return res;
      }

      // Initialize default row if not exists
      const now = new Date();
      await db
        .insert(systemSettings)
        .values({
          id: SETTINGS_ID,
          isSellerEnabled: true,
          updatedAt: now,
          updatedBy: "system",
        })
        .onConflictDoNothing();

      const defaultSettings: SystemSettings = {
        id: SETTINGS_ID,
        isSellerEnabled: true,
        updatedAt: now.toISOString(),
        updatedBy: "system",
      };
      await this.cacheSettings(defaultSettings);
      return defaultSettings;
    } catch (err) {
      console.error(
        "[SettingsService] Database lookup failed, falling back to enabled default:",
        err,
      );
      return {
        id: SETTINGS_ID,
        isSellerEnabled: true,
        updatedAt: new Date().toISOString(),
        updatedBy: "fallback",
      };
    }
  }

  /**
   * Fast-path check to evaluate if seller and vendor features are active.
   */
  public async isSellerFeatureEnabled(): Promise<boolean> {
    const settings = await this.getSystemSettings();
    return settings.isSellerEnabled;
  }

  /**
   * Updates project-wide seller enablement.
   * Restricted to Super Admin callers.
   */
  public async updateSystemSettings(
    isSellerEnabled: boolean,
    updatedBy?: string | null,
  ): Promise<SystemSettings> {
    const now = new Date();

    const existing = await db
      .select({ id: systemSettings.id })
      .from(systemSettings)
      .where(eq(systemSettings.id, SETTINGS_ID))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(systemSettings).values({
        id: SETTINGS_ID,
        isSellerEnabled,
        updatedAt: now,
        updatedBy: updatedBy ?? null,
      });
    } else {
      await db
        .update(systemSettings)
        .set({
          isSellerEnabled,
          updatedAt: now,
          updatedBy: updatedBy ?? null,
        })
        .where(eq(systemSettings.id, SETTINGS_ID));
    }

    const updated: SystemSettings = {
      id: SETTINGS_ID,
      isSellerEnabled,
      updatedAt: now.toISOString(),
      updatedBy: updatedBy ?? null,
    };

    await this.cacheSettings(updated);
    return updated;
  }

  private async cacheSettings(settings: SystemSettings): Promise<void> {
    try {
      const redis = cacheService.getRedis();
      await redis.client.set(
        CACHE_KEY,
        JSON.stringify(settings),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Non-blocking cache failure
    }
  }
}

export const settingsService = new SettingsService();
