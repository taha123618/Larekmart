import { consumer } from "./kafka";
import { createStripeProduct, deleteStripeProduct } from "./stripeProduct";

export const runKafkaSubscriptions = async () => {
  // consumer.subscribe("product.created", async (message) => {
  //   const product = message.value;
  //   console.log("Received message: product.created", product);

  //   await createStripeProduct(product);
  // });
  // consumer.subscribe("product.deleted", async (message) => {
  //   const productId = message.value;
  //   console.log("Received message: product.deleted", productId);

  //   await deleteStripeProduct(productId);
  // });

  consumer.subscribe([
    {
      topicName: "product.created",
      topicHandler: async (message) => {
        const product = message.value;
        console.log("Received message: product.created", product);

        await createStripeProduct(product);
      },
    },
    {
      topicName: "product.deleted",
      topicHandler: async (message) => {
        const productId = message.value;
        console.log("Received message: product.deleted", productId);

        await deleteStripeProduct(productId);
      },
    },
    {
      topicName: "return.refund.requested",
      topicHandler: async (message) => {
        const payload = message.value;
        console.log(
          "Received message: return.refund.requested",
          payload?.returnId,
        );

        if (payload) {
          const { handleReturnRefundRequest } = await import(
            "./refund.handler.js"
          );
          await handleReturnRefundRequest(payload);
        }
      },
    },
    {
      topicName: "payment.refund.requested",
      topicHandler: async (message) => {
        const payload = message.value;
        console.log(
          "Received message: payment.refund.requested",
          payload?.orderId,
        );

        if (payload) {
          const { handleCheckoutRefundRequest } = await import(
            "./refund.handler.js"
          );
          await handleCheckoutRefundRequest(payload);
        }
      },
    },
  ]);
};
