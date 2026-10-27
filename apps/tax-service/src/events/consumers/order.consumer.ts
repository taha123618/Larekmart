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
        await taxEventProducer.publishTaxCalculationFailed({
          calculationId: event.taxCalculationId,
          referenceId: orderId,
          referenceType: "order",
          error: `Non-existent tax calculation snapshot '${event.taxCalculationId}'`,
          failedAt: new Date().toISOString(),
        });
        return;
      }

      // Link calculation snapshot with finalized order ID
      await taxCalculationRepository.updateReference(
        event.taxCalculationId,
        orderId,
        "order",
      );

      // Emit tax.calculation.completed event for downstream systems (order-service, analytics, invoicing)
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

export async function handleOrderCancelledEvent(
  messageValue: unknown,
): Promise<void> {
  try {
    if (!messageValue || typeof messageValue !== "object") return;
    const event = messageValue as {
      orderId?: string;
      id?: string;
      taxCalculationId?: string;
      reason?: string;
    };
    const orderId = event.orderId || event.id;
    if (!orderId) return;

    let calculationId = event.taxCalculationId;

    if (!calculationId) {
      const record = await taxCalculationRepository.findByReferenceId(orderId);
      if (record) {
        calculationId = record.id;
      }
    }

    if (calculationId) {
      await taxCalculationRepository.updateReference(
        calculationId,
        orderId,
        "voided",
      );

      await taxEventProducer.publishTaxCalculationVoided({
        calculationId,
        referenceId: orderId,
        referenceType: "voided",
        reason: event.reason || "Order cancelled by saga orchestrator",
        voidedAt: new Date().toISOString(),
      });

      console.log(
        `[TaxService] Tax calculation '${calculationId}' voided for Order '${orderId}'`,
      );
    }
  } catch (err) {
    console.error("[TaxService] Error handling order.cancelled event:", err);
  }
}
