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
      {
        topicName: "return.requested",
        topicHandler: async (message) => {
          const { returnId, orderId, customerId } = message.value || {};
          logger.info(
            `[email-service] Return requested for RMA #${returnId} on order #${orderId} (Customer: ${customerId})`,
          );
        },
      },
      {
        topicName: "return.approved",
        topicHandler: async (message) => {
          const { returnId, orderId, providePrepaidLabel } =
            message.value || {};
          logger.info(
            `[email-service] Return approved for RMA #${returnId} on order #${orderId} (Prepaid: ${providePrepaidLabel})`,
          );
        },
      },
      {
        topicName: "return.rejected",
        topicHandler: async (message) => {
          const { returnId, orderId, rejectionReason } = message.value || {};
          logger.info(
            `[email-service] Return rejected for RMA #${returnId} on order #${orderId} (Reason: ${rejectionReason})`,
          );
        },
      },
      {
        topicName: "return.completed",
        topicHandler: async (message) => {
          const { returnId, orderId, amount, currency } = message.value || {};
          logger.info(
            `[email-service] Return refund completed for RMA #${returnId} on order #${orderId} (Refund: ${amount} ${currency || "USD"})`,
          );
        },
      },
      {
        topicName: "vendor.registered",
        topicHandler: async (message) => {
          const { legalName, contactEmail, vendorId } = message.value || {};
          logger.info(
            `[email-service] Vendor registration received for '${legalName}' (${vendorId})`,
          );
          if (contactEmail) {
            await sendMail({
              email: contactEmail,
              subject: "KYB Application Received - Larekmart Merchant Network",
              text: `Dear ${legalName || "Merchant"},\n\nYour business registration (ID: ${vendorId}) has been received and is currently under review by our compliance team.\n\nThank you for choosing Larekmart.`,
            });
          }
        },
      },
      {
        topicName: "vendor.verified",
        topicHandler: async (message) => {
          const { legalName, contactEmail, vendorId } = message.value || {};
          logger.info(
            `[email-service] Vendor verified: '${legalName}' (${vendorId})`,
          );
          if (contactEmail) {
            await sendMail({
              email: contactEmail,
              subject:
                "Congratulations! Your KYB Application is Approved - Larekmart",
              text: `Dear ${legalName || "Merchant"},\n\nYour business organization has passed verification. You can now launch active seller storefronts on Larekmart.\n\nVisit your dashboard to get started.`,
            });
          }
        },
      },
      {
        topicName: "vendor.rejected",
        topicHandler: async (message) => {
          const { legalName, contactEmail, vendorId, reason } =
            message.value || {};
          logger.info(
            `[email-service] Vendor rejected: '${legalName}' (${vendorId}) - Reason: ${reason}`,
          );
          if (contactEmail) {
            await sendMail({
              email: contactEmail,
              subject: "Update on Your Larekmart Business Verification",
              text: `Dear ${legalName || "Merchant"},\n\nOur compliance team reviewed your KYB documentation. At this time, additional information is required:\n\nReason: ${reason || "Document requirements not met"}\n\nPlease submit updated documents through the merchant portal.`,
            });
          }
        },
      },
      {
        topicName: "seller.created",
        topicHandler: async (message) => {
          const { storeName, slug, contactEmail } = message.value || {};
          logger.info(
            `[email-service] Storefront created: '${storeName}' (/stores/${slug})`,
          );
          if (contactEmail) {
            await sendMail({
              email: contactEmail,
              subject: `Your Storefront '${storeName}' Has Been Created!`,
              text: `Welcome to Larekmart Marketplace!\n\nYour storefront '${storeName}' is configured. Shoppers will be able to discover your products at /stores/${slug}.\n\nNext steps: upload your product catalog and verify your shipping policies.`,
            });
          }
        },
      },
      {
        topicName: "seller.activated",
        topicHandler: async (message) => {
          const { storeName, slug, contactEmail } = message.value || {};
          logger.info(
            `[email-service] Storefront activated: '${storeName}' (/stores/${slug})`,
          );
          if (contactEmail) {
            await sendMail({
              email: contactEmail,
              subject: `Your Storefront '${storeName}' is Now Live!`,
              text: `Great news! Your storefront '${storeName}' is now active on the Larekmart marketplace. Customers can now browse and purchase your catalog.`,
            });
          }
        },
      },
      {
        topicName: "seller.suspended",
        topicHandler: async (message) => {
          const { sellerId, reason, contactEmail } = message.value || {};
          logger.warn(
            `[email-service] Storefront suspended: '${sellerId}', reason: '${reason}'`,
          );
          if (contactEmail) {
            await sendMail({
              email: contactEmail,
              subject:
                "Notice: Your Larekmart Seller Storefront Has Been Suspended",
              text: `Dear Merchant,\n\nYour marketplace storefront has been suspended.\n\nReason: ${reason || "Marketplace policy violation"}\n\nPlease contact merchant support or review your seller dashboard for resolution.`,
            });
          }
        },
      },
    ]);
  } catch (error) {
    logger.fatal("Email service consumer error", error);
    process.exit(1);
  }
};

start();
