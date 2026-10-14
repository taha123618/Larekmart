import { reservationRepository } from "../repositories/reservation.repository.js";
import { logger } from "../observability/metrics.js";

/**
 * Periodically releases reservations that passed their TTL.
 */
export function startReservationExpiryWorker(intervalMs = 60000): () => void {
  const interval = setInterval(async () => {
    try {
      const released = await reservationRepository.releaseExpiredReservations();
      if (released > 0) {
        logger.info(
          `[ExpiryWorker] Released ${released} expired promotion reservations`,
        );
      }
    } catch (error) {
      logger.error("[ExpiryWorker] Error releasing expired reservations:", {
        error,
      });
    }
  }, intervalMs);

  return () => clearInterval(interval);
}
