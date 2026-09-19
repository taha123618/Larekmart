import { expirationService } from "../services/expiration.service.js";
import { logger } from "../observability/metrics.js";

let workerInterval: NodeJS.Timeout | null = null;

export const startCartExpirationWorker = (intervalMs: number = 60000): void => {
  if (workerInterval) return;

  logger.info("Starting cart expiration background worker", { intervalMs });
  workerInterval = setInterval(async () => {
    try {
      await expirationService.reapExpiredCarts();
    } catch (err) {
      logger.error(
        "Unhandled error in cart expiration worker loop",
        err as Error,
      );
    }
  }, intervalMs);
};

export const stopCartExpirationWorker = (): void => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info("Stopped cart expiration background worker");
  }
};
