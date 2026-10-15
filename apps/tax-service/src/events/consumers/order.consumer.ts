import { taxCalculationRepository } from "../../repositories/tax-calculation.repository.js";
import { taxEventProducer } from "../producers/tax.producer.js";

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
        return;
      }

      // Link calculation snapshot with finalized order ID
      await taxCalculationRepository.updateReference(
        event.taxCalculationId,
        orderId,
        "order",
      );

      // Emit tax.calculation.completed event for downstream systems (analytics, invoicing)
      await taxEventProducer.publishTaxCalculationCompleted({
        calculationId: calculation.calculationId,
        referenceId: orderId,
        referenceType: "order",
        currency: calculation.currency,
        subtotal: calculation.subtotal,
        taxTotal: calculation.taxTotal,
        total: calculation.total,
        ruleVersion: calculation.ruleVersion,
        completedAt: new Date().toISOString(),
      });

      console.log(
        `[TaxService] Tax calculation '${calculation.calculationId}' settled for Order '${orderId}' (taxTotal: ${calculation.taxTotal})`,
      );
    }
  } catch (err) {
    console.error("[TaxService] Error handling order.created event:", err);
  }
}
