import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { systemSettings } from "../db/schema.js";
import { cacheService } from "./cache.service.js";
import { sellerEventProducer } from "../kafka/producer.js";
import type { SystemSettings, UpdateSystemSettingsInput } from "@repo/types";

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
          isSellerRegistrationOpen: row.isSellerRegistrationOpen,
          isStorefrontsActive: row.isStorefrontsActive,
          maintenanceMessage: row.maintenanceMessage,
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
          isSellerRegistrationOpen: true,
          isStorefrontsActive: true,
          maintenanceMessage:
            "Marketplace seller operations are temporarily paused for routine maintenance.",
          updatedAt: now,
          updatedBy: "system",
        })
        .onConflictDoNothing();

      const defaultSettings: SystemSettings = {
        id: SETTINGS_ID,
        isSellerEnabled: true,
        isSellerRegistrationOpen: true,
        isStorefrontsActive: true,
        maintenanceMessage:
          "Marketplace seller operations are temporarily paused for routine maintenance.",
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
        isSellerRegistrationOpen: true,
        isStorefrontsActive: true,
        maintenanceMessage:
          "Marketplace seller operations are temporarily paused for routine maintenance.",
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
   * Fast-path check to evaluate if seller registration / onboarding is open.
   */
  public async isSellerRegistrationOpen(): Promise<boolean> {
    const settings = await this.getSystemSettings();
    return settings.isSellerEnabled && settings.isSellerRegistrationOpen;
  }

  /**
   * Fast-path check to evaluate if marketplace storefronts are active for browsing/purchasing.
   */
  public async isStorefrontsActive(): Promise<boolean> {
    const settings = await this.getSystemSettings();
    return settings.isSellerEnabled && settings.isStorefrontsActive;
  }

  /**
   * Updates project-wide seller enablement and operational sub-switches.
   * Restricted to Super Admin callers.
   */
  public async updateSystemSettings(
    input: boolean | UpdateSystemSettingsInput,
    updatedBy?: string | null,
  ): Promise<SystemSettings> {
    const now = new Date();
    const current = await this.getSystemSettings();

    const normalized: UpdateSystemSettingsInput =
      typeof input === "boolean" ? { isSellerEnabled: input } : input;

    const newIsSellerEnabled =
      normalized.isSellerEnabled !== undefined
        ? normalized.isSellerEnabled
        : current.isSellerEnabled;

    const newIsSellerRegistrationOpen =
      normalized.isSellerRegistrationOpen !== undefined
        ? normalized.isSellerRegistrationOpen
        : current.isSellerRegistrationOpen;

    const newIsStorefrontsActive =
      normalized.isStorefrontsActive !== undefined
        ? normalized.isStorefrontsActive
        : current.isStorefrontsActive;

    const newMaintenanceMessage =
      normalized.maintenanceMessage !== undefined
        ? normalized.maintenanceMessage
        : current.maintenanceMessage;

    const existing = await db
      .select({ id: systemSettings.id })
      .from(systemSettings)
      .where(eq(systemSettings.id, SETTINGS_ID))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(systemSettings).values({
        id: SETTINGS_ID,
        isSellerEnabled: newIsSellerEnabled,
        isSellerRegistrationOpen: newIsSellerRegistrationOpen,
        isStorefrontsActive: newIsStorefrontsActive,
        maintenanceMessage: newMaintenanceMessage,
        updatedAt: now,
        updatedBy: updatedBy ?? null,
      });
    } else {
      await db
        .update(systemSettings)
        .set({
          isSellerEnabled: newIsSellerEnabled,
          isSellerRegistrationOpen: newIsSellerRegistrationOpen,
          isStorefrontsActive: newIsStorefrontsActive,
          maintenanceMessage: newMaintenanceMessage,
          updatedAt: now,
          updatedBy: updatedBy ?? null,
        })
        .where(eq(systemSettings.id, SETTINGS_ID));
    }

    const updated: SystemSettings = {
      id: SETTINGS_ID,
      isSellerEnabled: newIsSellerEnabled,
      isSellerRegistrationOpen: newIsSellerRegistrationOpen,
      isStorefrontsActive: newIsStorefrontsActive,
      maintenanceMessage: newMaintenanceMessage,
      updatedAt: now.toISOString(),
      updatedBy: updatedBy ?? null,
    };

    await this.cacheSettings(updated);

    // Publish event asynchronously to inform downstream services and frontends
    await sellerEventProducer.publishSettingsUpdated({
      settings: updated,
      updatedBy: updatedBy ?? null,
      timestamp: now.toISOString(),
    });

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
