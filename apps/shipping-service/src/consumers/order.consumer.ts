import { consumer } from "../utils/kafka.js";
import { ShipmentService } from "../services/shipment.service.js";
import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { env } from "../config/env.js";
import type { OrderCreatedType } from "@repo/types";

export const startOrderConsumer = async () => {
  await consumer.subscribe([
    {
      topicName: "order.created",
      topicHandler: async (message) => {
        try {
          const payload = message.value as OrderCreatedType;
          if (!payload || !payload.orderId) {
            console.warn(
              "[OrderConsumer] Received order.created event without orderId, skipping",
            );
            return;
          }

          console.log(
            `[OrderConsumer] Processing order.created for order ${payload.orderId}`,
          );

          // Extract products if available
          const rawProducts = Array.isArray(payload.products)
            ? payload.products
            : [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items = rawProducts.map((p: any, idx: number) => ({
            productId: p.productId || `prod_${idx + 1}`,
            name: p.name || "Purchased Item",
            quantity: Number(p.quantity) || 1,
            price: Number(p.price) || 0,
            weight: 0.5,
          }));

          // If no products were included in the event, provide a fallback item
          if (items.length === 0) {
            items.push({
              productId: "general_order",
              name: `Order #${payload.orderId} Package`,
              quantity: 1,
              price: payload.amount || 0,
              weight: 1.0,
            });
          }

          const shippingAddress = payload.shippingAddress
            ? {
                fullName: payload.shippingAddress.fullName,
                phone: payload.shippingAddress.phone,
                addressLine1: payload.shippingAddress.addressLine1,
                addressLine2: payload.shippingAddress.addressLine2 ?? null,
                city: payload.shippingAddress.city,
                state: payload.shippingAddress.state ?? null,
                postalCode: payload.shippingAddress.postalCode,
                country: payload.shippingAddress.country ?? "PK",
              }
            : {
                fullName: payload.email?.split("@")[0] || "Customer",
                phone: "03001234567",
                addressLine1: "Primary Delivery Address",
                city: "Karachi",
                postalCode: "74000",
                country: "PK",
              };

          // Create pending shipment with accurate carrier and COD settings
          await ShipmentService.createShipment({
            orderId: payload.orderId,
            userId: payload.userId,
            carrier: payload.carrier || env.DEFAULT_CARRIER,
            serviceType: payload.serviceType || "standard",
            isCod: Boolean(payload.isCod),
            codAmount: payload.codAmount ?? (payload.isCod ? payload.amount : null),
            codFee: payload.codFee ?? 0,
            shippingAddress,
            items,
            packages: [{ weight: 1.0, packageType: "box" }],
            shippingRateAmount: payload.shippingRateAmount ?? 200,
            currency: "PKR",
            metadata: {
              sourceEvent: "order.created",
              customerEmail: payload.email,
              paymentMethod: payload.paymentMethod || (payload.isCod ? "cod" : "card"),
            },
          });

          console.log(
            `[OrderConsumer] Shipment created for order ${payload.orderId}`,
          );
        } catch (error) {
          console.error(
            "[OrderConsumer] Error handling order.created message:",
            error,
          );
        }
      },
    },
    {
      topicName: "order.cancelled",
      topicHandler: async (message) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload = message.value as any;
          const orderId = payload?.orderId || payload?.id;
          if (!orderId) return;

          console.log(
            `[OrderConsumer] Processing order.cancelled for order ${orderId}`,
          );
          const shipment = await ShipmentRepository.findByOrderId(orderId);
          if (shipment) {
            await ShipmentService.cancelShipment(
              shipment.id,
              payload.reason || "Order was cancelled",
            );
            console.log(
              `[OrderConsumer] Cancelled shipment ${shipment.id} for order ${orderId}`,
            );
          }
        } catch (error) {
          console.error(
            "[OrderConsumer] Error handling order.cancelled message:",
            error,
          );
        }
      },
    },
  ]);
};
