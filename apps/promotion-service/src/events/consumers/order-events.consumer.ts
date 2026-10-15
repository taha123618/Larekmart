import { reservationRepository } from "../../repositories/reservation.repository.js";
import {
  publishPromotionRedeemed,
  publishPromotionReservationReleased,
  publishPromotionBudgetExhausted,
} from "../producers/promotion.producer.js";
import {
  recordPromotionRedemption,
  recordBudgetExhausted,
  logger,
} from "../../observability/metrics.js";

interface OrderEventPayload {
  orderId?: string;
  id?: string;
  reservationId?: string;
  promotionReservationId?: string;
  totalAmount?: number;
  total?: number;
  guestEmail?: string;
  data?: {
    orderId?: string;
    id?: string;
    reservationId?: string;
    totalAmount?: number;
  };
}

export async function handleOrderConfirmed(rawPayload: unknown): Promise<void> {
  try {
    const payload = rawPayload as OrderEventPayload;
    const orderId =
      payload.orderId ||
      payload.id ||
      payload.data?.orderId ||
      payload.data?.id;
    const reservationId =
      payload.reservationId ||
      payload.promotionReservationId ||
      payload.data?.reservationId;

    if (!orderId || !reservationId) {
      return;
    }

    logger.info(
      `[Kafka] Processing order confirmed for order ${orderId}, reservation ${reservationId}`,
    );

    const { redemption, reservation, exhausted } =
      await reservationRepository.commitReservation(reservationId, orderId);

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
  } catch (error) {
    logger.error(
      "Error processing order confirmed event in promotion-service:",
      { error },
    );
  }
}

export async function handleOrderCancelled(rawPayload: unknown): Promise<void> {
  try {
    const payload = rawPayload as OrderEventPayload;
    const reservationId =
      payload.reservationId ||
      payload.promotionReservationId ||
      payload.data?.reservationId;

    if (!reservationId) {
      return;
    }

    logger.info(
      `[Kafka] Processing order cancelled for reservation ${reservationId}`,
    );

    const released =
      await reservationRepository.releaseReservation(reservationId);
    if (released) {
      await publishPromotionReservationReleased({
        reservationId: released.id,
        promotionId: released.promotionId,
        discountAmount: released.discountAmount,
        releasedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error(
      "Error processing order cancelled event in promotion-service:",
      { error },
    );
  }
}
