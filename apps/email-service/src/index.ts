import sendMail from "./utils/mailer.js";
import { createConsumer, createKafkaClient } from "@repo/kafka";
import { createLogger } from "@repo/monitoring";

const logger = createLogger("email-service");
const kafkaBrokers = (
  process.env.KAFKA_BROKERS || "localhost:9094,localhost:9095,localhost:9096"
)
  .split(",")
  .map((b) => b.trim());
const kafka = createKafkaClient("email-service", kafkaBrokers);
const consumer = createConsumer(kafka, "email-service");

const start = async () => {
  try {
    await consumer.connect();
    logger.info("Email service connected to Kafka");

    await consumer.subscribe([
      {
        topicName: "user.created",
        topicHandler: async (message) => {
          const { email, username } = message.value;

          if (email) {
            logger.info(`Sending welcome email to ${email}`);
            await sendMail({
              email,
              subject: "Welcome to Larekmart",
              text: `Welcome ${username || "Customer"}. Your account has been created!`,
            });
          }
        },
      },
      {
        topicName: "user.registered",
        topicHandler: async (message) => {
          const { email, firstName, username } = message.value;

          if (email) {
            logger.info(`Sending welcome email on user.registered to ${email}`);
            await sendMail({
              email,
              subject: "Welcome to Larekmart",
              text: `Welcome ${firstName || username || "Customer"}! Thank you for joining Larekmart.`,
            });
          }
        },
      },
      {
        topicName: "order.created",
        topicHandler: async (message) => {
          const { email, amount, status, taxAmount } = message.value;

          if (email) {
            logger.info(`Sending order confirmation receipt to ${email}`);
            const taxDetail =
              taxAmount && Number(taxAmount) > 0
                ? `, Tax: $${(Number(taxAmount) / 100).toFixed(2)}`
                : "";
            await sendMail({
              email,
              subject: "Order Confirmation - Larekmart",
              text: `Hello! Your order: Amount: $${(amount / 100).toFixed(2)}${taxDetail}, Status: ${status}`,
            });
          }
        },
      },
      {
        topicName: "tax.calculation.adjusted",
        topicHandler: async (message) => {
          const { referenceId, taxRefundTotal, returnCalculationId } =
            message.value;
          logger.info(
            `[email-service] Tax refund adjustment for reference ${referenceId || returnCalculationId} (Refund: $${taxRefundTotal})`,
          );
        },
      },
      {
        topicName: "email.dispatch",
        topicHandler: async (message) => {
          const { recipient, subject, body } = message.value;

          if (recipient) {
            logger.info(
              `Sending dispatched email notification to ${recipient}`,
            );
            await sendMail({
              email: recipient,
              subject: subject || "Notification - Larekmart",
              text: body || "",
            });
          }
        },
      },
      {
        topicName: "shipment.shipped",
        topicHandler: async (message) => {
          const { trackingNumber, carrier, orderId } = message.value;
          logger.info(
            `[email-service] Shipment dispatched for order ${orderId} (Carrier: ${carrier}, Tracking: ${trackingNumber})`,
          );
        },
      },
      {
        topicName: "shipment.delivered",
        topicHandler: async (message) => {
          const { trackingNumber, carrier, orderId } = message.value;
          logger.info(
            `[email-service] Shipment delivered for order ${orderId} (Carrier: ${carrier}, Tracking: ${trackingNumber})`,
          );
        },
      },
      {
        topicName: "promotion.redeemed",
        topicHandler: async (message) => {
          const { orderId, discountAmount, userId } = message.value || {};
          logger.info(
            `[email-service] Promotion savings applied for order ${orderId} (Discount: $${Number(discountAmount || 0).toFixed(2)}, User: ${userId || "guest"})`,
          );
        },
      },
    ]);
  } catch (error) {
    logger.fatal("Email service consumer error", error);
    process.exit(1);
  }
};

start();
