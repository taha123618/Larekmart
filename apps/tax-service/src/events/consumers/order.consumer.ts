import { taxCalculationRepository } from "../../repositories/tax-calculation.repository.js";

export async function handleOrderCreatedEvent(
  messageValue: unknown,
): Promise<void> {
  try {
    if (!messageValue || typeof messageValue !== "object") return;
    const event = messageValue as {
      orderId?: string;
      id?: string;
      taxCalculationId?: string;
    };
    const orderId = event.orderId || event.id;

    if (!orderId) return;

    if (event.taxCalculationId) {
      const calculation = await taxCalculationRepository.findById(
        event.taxCalculationId,
      );
      if (!calculation) {
        console.warn(
          `[TaxService] Warning: Order '${orderId}' references non-existent tax calculation '${event.taxCalculationId}'`,
        );
      }
    }
  } catch (err) {
    console.error("[TaxService] Error handling order.created event:", err);
  }
}
