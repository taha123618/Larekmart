import sendMail from "./utils/mailer.js";
import { createConsumer, createKafkaClient } from "@repo/kafka";
import { createLogger } from "@repo/monitoring";

const logger = createLogger("email-service");
const kafka = createKafkaClient("email-service");
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
              text: `Welcome ${username}. Your account has been created!`,
            });
          }
        },
      },
      {
        topicName: "order.created",
        topicHandler: async (message) => {
          const { email, amount, status } = message.value;

          if (email) {
            logger.info(`Sending order confirmation receipt to ${email}`);
            await sendMail({
              email,
              subject: "Order Confirmation - Larekmart",
              text: `Hello! Your order: Amount: $${(amount / 100).toFixed(2)}, Status: ${status}`,
            });
          }
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
    ]);
  } catch (error) {
    logger.fatal("Email service consumer error", error);
  }
};

start();
