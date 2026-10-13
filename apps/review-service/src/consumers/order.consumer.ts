import { eligibilityRepository } from "../repositories/eligibility.repository.js";

export async function handleOrderDelivered(payload: any): Promise<void> {
  try {
    const data = payload?.data || payload;
    const userId = data?.userId;
    const orderId = data?.orderId || data?.id;
    const items = data?.items || data?.products || [];
    const deliveredAt = data?.deliveredAt
      ? new Date(data.deliveredAt)
      : new Date();

    if (!userId || !orderId || !Array.isArray(items)) {
      console.warn("[OrderConsumer] Invalid order.delivered payload:", payload);
      return;
    }

    console.log(
      `[OrderConsumer] Processing purchase eligibility for order ${orderId}, user ${userId}`,
    );

    for (const item of items) {
      const productId =
        item.productId || item.product?.id || item.id || item.name;
      const orderItemId =
        item.orderItemId || item._id || item.id || `${orderId}_${productId}`;

      if (productId) {
        await eligibilityRepository.createEligibility({
          userId,
          productId: String(productId),
          orderId: String(orderId),
          orderItemId: String(orderItemId),
          deliveredAt,
        });
        console.log(
          `[OrderConsumer] Unlocked review eligibility: user ${userId} -> product ${productId}`,
        );
      }
    }
  } catch (error) {
    console.error(
      "[OrderConsumer] Error handling order.delivered event:",
      error,
    );
  }
}
