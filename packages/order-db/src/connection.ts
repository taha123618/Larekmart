import mongoose from "mongoose";
import { createLogger, captureError } from "@repo/monitoring";

const logger = createLogger("order-db");
let isConnected = false;

export const connectOrderDB = async () => {
  if (isConnected) return;

  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is not defined in env file!");
  }

  try {
    await mongoose.connect(process.env.MONGO_URL);
    isConnected = true;
    logger.info("Connected to MongoDB database successfully");
  } catch (error) {
    captureError(error, {
      serviceName: "order-db",
      logger,
      context: "connectOrderDB",
    });
    throw error;
  }
};
