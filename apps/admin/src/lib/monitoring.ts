import {
  createLogger,
  formatError,
  captureError,
  startTimer,
} from "@repo/monitoring";

export const adminLogger = createLogger("admin-portal");

export { formatError, captureError, startTimer };
