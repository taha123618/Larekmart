import {
  createLogger,
  formatError,
  captureError,
  startTimer,
} from "@repo/monitoring";

export const clientLogger = createLogger("client-storefront");

export { formatError, captureError, startTimer };
