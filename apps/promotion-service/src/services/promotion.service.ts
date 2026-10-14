import { promotionRepository } from "../repositories/promotion.repository.js";
import { couponRepository } from "../repositories/coupon.repository.js";
import { reservationRepository } from "../repositories/reservation.repository.js";
import { promotionEvaluator } from "./promotion-evaluator.js";
import { redis } from "../utils/redis.js";
import { cacheRead, cacheSet, cacheDel } from "@repo/redis";
import {
  publishPromotionCreated,
  publishPromotionActivated,
  publishPromotionDeactivated,
  publishPromotionReserved,
  publishPromotionRedeemed,
  publishPromotionReservationReleased,
  publishPromotionBudgetExhausted,
} from "../events/producers/promotion.producer.js";
import {
  recordPromotionOperation,
  recordPromotionReservation,
  recordPromotionRedemption,
  recordBudgetExhausted,
  logger,
} from "../observability/metrics.js";
import type {
  Promotion,
  CouponCode,
  PromotionReservation,
  PromotionRedemption,
  CreatePromotionInput,
  UpdatePromotionInput,
  CreateCouponInput,
  CreateReservationInput,
  ValidateCouponInput,
  ValidateCouponResponse,
  PromotionQuoteInput,
  PromotionQuoteResponse,
  PromotionOverviewResponse,
} from "@repo/types";

const ACTIVE_PROMOTIONS_CACHE_KEY = "promotions:active";
const CACHE_TTL_SECONDS = 60; // 1 minute read cache

export class PromotionService {
  /**
   * Get all active promotions, utilizing short-lived Redis cache.
   */
  async getActivePromotions(): Promise<Promotion[]> {
    try {
      const res = await cacheRead<Promotion[]>(
        redis.client,
        ACTIVE_PROMOTIONS_CACHE_KEY,
      );
      if (res.status === "hit" && res.value) return res.value;
    } catch (e) {
      logger.warn("Redis get error for active promotions, reading from db", {
        e,
      });
    }

    const active = await promotionRepository.findActive();

    try {
      await cacheSet(
        redis.client,
        ACTIVE_PROMOTIONS_CACHE_KEY,
        active,
        CACHE_TTL_SECONDS,
      );
    } catch (e) {
      logger.warn("Redis set error for active promotions", { e });
    }

    return active;
  }

  /**
   * Get promotion by ID
   */
  async getPromotionById(id: string): Promise<Promotion | null> {
    return await promotionRepository.findById(id);
  }

  /**
   * Validate a single coupon code against cart items
   */
  async validateCoupon(
    input: ValidateCouponInput,
  ): Promise<ValidateCouponResponse> {
    recordPromotionOperation("validate_coupon");

    const couponResult = await couponRepository.findByCode(input.code);
    if (!couponResult) {
      return {
        valid: false,
        code: input.code,
        reason: `Coupon code '${input.code}' is invalid`,
      };
    }

    const { coupon, promotion } = couponResult;

    if (!coupon.isActive) {
      return {
        valid: false,
        code: input.code,
        reason: "Coupon code is inactive",
      };
    }

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return {
        valid: false,
        code: input.code,
        reason: "Coupon code has expired",
      };
    }

    if (
      coupon.maxRedemptions != null &&
      coupon.redemptionsCount >= coupon.maxRedemptions
    ) {
      return {
        valid: false,
        code: input.code,
        reason: "Coupon code redemption limit has been reached",
      };
    }

    // Check customer usage
    const customerUsageCount =
      await reservationRepository.getCustomerUsageCount(
        promotion.id,
        input.userId,
        input.guestId,
      );

    // Fetch full promotion details (rules, targets)
    const fullPromo = await promotionRepository.findById(promotion.id);
    if (!fullPromo) {
      return {
        valid: false,
        code: input.code,
        reason: "Promotion not found",
      };
    }

    const evalResult = promotionEvaluator.evaluatePromotion(
      fullPromo,
      input.items,
      {
        userId: input.userId,
        guestId: input.guestId,
        customerUsageCount,
      },
    );

    if (!evalResult.eligible) {
      return {
        valid: false,
        code: input.code,
        promotionId: promotion.id,
        promotionName: promotion.name,
        reason: evalResult.reason,
      };
    }

    return {
      valid: true,
      code: input.code,
      promotionId: promotion.id,
      promotionName: promotion.name,
      discountType: promotion.type,
      discountValue: promotion.discountValue,
      estimatedDiscount: evalResult.discountAmount,
    };
  }

  /**
   * Calculate a comprehensive promotion quote for cart items, with automatic campaigns and coupons.
   */
  async quotePromotions(
    input: PromotionQuoteInput,
  ): Promise<PromotionQuoteResponse> {
    recordPromotionOperation("quote");

    const candidates: Array<{ promotion: Promotion; code?: string }> = [];
    const invalidCoupons: Array<{ code: string; reason: string }> = [];
    const includedPromotionIds = new Set<string>();

    // 1. Add valid coupon candidates first
    if (input.couponCodes && input.couponCodes.length > 0) {
      for (const rawCode of input.couponCodes) {
        const couponResult = await couponRepository.findByCode(rawCode);
        if (!couponResult) {
          invalidCoupons.push({
            code: rawCode,
            reason: "Coupon code not found",
          });
          continue;
        }

        const { coupon, promotion } = couponResult;
        if (!coupon.isActive) {
          invalidCoupons.push({ code: rawCode, reason: "Coupon is disabled" });
          continue;
        }

        if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
          invalidCoupons.push({ code: rawCode, reason: "Coupon has expired" });
          continue;
        }

        const fullPromo = await promotionRepository.findById(promotion.id);
        if (fullPromo && !includedPromotionIds.has(fullPromo.id)) {
          candidates.push({ promotion: fullPromo, code: coupon.code });
          includedPromotionIds.add(fullPromo.id);
        }
      }
    }

    // 2. Add active automatic campaigns (skip if already applied via coupon)
    const activePromos = await this.getActivePromotions();
    for (const p of activePromos) {
      if (!includedPromotionIds.has(p.id)) {
        candidates.push({ promotion: p });
        includedPromotionIds.add(p.id);
      }
    }

    // 3. Evaluate cart
    const quote = promotionEvaluator.evaluateCartPromotions(
      candidates,
      input.items,
      {
        userId: input.userId,
        guestId: input.guestId,
      },
    );

    // Merge any upfront invalid coupons
    quote.invalidCoupons.push(...invalidCoupons);

    return quote;
  }

  /**
   * Create an ACID reservation during checkout.
   */
  async createReservation(
    input: CreateReservationInput,
  ): Promise<PromotionReservation> {
    recordPromotionOperation("create_reservation");

    const promo = await promotionRepository.findById(input.promotionId);
    if (!promo) {
      throw new Error(`Promotion '${input.promotionId}' not found`);
    }

    if (promo.status !== "ACTIVE") {
      throw new Error(
        `Promotion is in status '${promo.status}' and cannot be reserved`,
      );
    }

    let coupon: CouponCode | undefined;
    if (input.couponCode) {
      const couponResult = await couponRepository.findByCode(input.couponCode);
      if (!couponResult) {
        throw new Error(`Coupon code '${input.couponCode}' is invalid`);
      }
      coupon = couponResult.coupon;
    }

    const { reservation, exhausted } =
      await reservationRepository.createReservation(input, promo, coupon);

    recordPromotionReservation(promo.id);

    await publishPromotionReserved({
      reservationId: reservation.id,
      promotionId: promo.id,
      userId: reservation.userId ?? undefined,
      discountAmount: reservation.discountAmount,
      expiresAt: reservation.expiresAt,
    });

    if (exhausted) {
      recordBudgetExhausted(promo.id);
      await publishPromotionBudgetExhausted({
        promotionId: promo.id,
        exhaustedAt: new Date().toISOString(),
      });
    }

    return reservation;
  }

  /**
   * Commit a reservation on order completion.
   */
  async commitReservation(
    id: string,
    orderId: string,
  ): Promise<PromotionRedemption> {
    recordPromotionOperation("commit_reservation");

    const { redemption, reservation, exhausted } =
      await reservationRepository.commitReservation(id, orderId);

    recordPromotionRedemption(reservation.promotionId);

    await publishPromotionRedeemed({
      redemptionId: redemption.id,
      promotionId: reservation.promotionId,
      orderId,
      userId: reservation.userId ?? undefined,
      discountAmount: redemption.discountAmount,
      redeemedAt: redemption.redeemedAt,
    });

    if (exhausted) {
      recordBudgetExhausted(reservation.promotionId);
      await publishPromotionBudgetExhausted({
        promotionId: reservation.promotionId,
        exhaustedAt: new Date().toISOString(),
      });
    }

    return redemption;
  }

  /**
   * Release a reservation on checkout cancellation or expiry.
   */
  async releaseReservation(
    id: string,
    reason?: string,
  ): Promise<PromotionReservation | null> {
    recordPromotionOperation("release_reservation");

    const released = await reservationRepository.releaseReservation(id);
    if (released) {
      await publishPromotionReservationReleased({
        reservationId: released.id,
        promotionId: released.promotionId,
        discountAmount: released.discountAmount,
        releasedAt: new Date().toISOString(),
      });
    }
    return released;
  }

  // --- Admin Operations ---

  async createPromotion(
    input: CreatePromotionInput,
    actorId = "system",
  ): Promise<Promotion> {
    recordPromotionOperation("admin_create_promotion");
    const promo = await promotionRepository.create(input, actorId);
    await this.invalidateActiveCache();

    await publishPromotionCreated({
      promotionId: promo.id,
      name: promo.name,
      type: promo.type,
      status: promo.status,
      startDate: promo.startDate,
      endDate: promo.endDate,
      createdAt: promo.createdAt,
    });

    return promo;
  }

  async updatePromotion(
    id: string,
    input: UpdatePromotionInput,
    actorId = "system",
  ): Promise<Promotion | null> {
    recordPromotionOperation("admin_update_promotion");
    const promo = await promotionRepository.update(id, input, actorId);
    await this.invalidateActiveCache();
    return promo;
  }

  async activatePromotion(
    id: string,
    actorId = "system",
  ): Promise<Promotion | null> {
    recordPromotionOperation("admin_activate_promotion");
    const promo = await promotionRepository.activate(id, actorId);
    await this.invalidateActiveCache();

    if (promo) {
      await publishPromotionActivated({
        promotionId: promo.id,
        name: promo.name,
        activatedAt: new Date().toISOString(),
      });
    }

    return promo;
  }

  async deactivatePromotion(
    id: string,
    actorId = "system",
  ): Promise<Promotion | null> {
    recordPromotionOperation("admin_deactivate_promotion");
    const promo = await promotionRepository.deactivate(id, actorId);
    await this.invalidateActiveCache();

    if (promo) {
      await publishPromotionDeactivated({
        promotionId: promo.id,
        name: promo.name,
        deactivatedAt: new Date().toISOString(),
      });
    }

    return promo;
  }

  async createCoupon(input: CreateCouponInput): Promise<CouponCode> {
    recordPromotionOperation("admin_create_coupon");
    return await couponRepository.createCoupon(input);
  }

  async getPromotionRedemptions(
    promotionId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ redemptions: PromotionRedemption[]; total: number }> {
    return await promotionRepository.getRedemptions(promotionId, limit, offset);
  }

  async getOverview(): Promise<PromotionOverviewResponse> {
    return await promotionRepository.getOverview();
  }

  private async invalidateActiveCache(): Promise<void> {
    try {
      await cacheDel(redis.client, ACTIVE_PROMOTIONS_CACHE_KEY);
    } catch (e) {
      logger.warn("Failed to invalidate active promotions cache", { e });
    }
  }
}

export const promotionService = new PromotionService();
