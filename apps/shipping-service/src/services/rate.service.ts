import { ShipmentRepository } from "../repositories/shipment.repository.js";
import { ProviderRegistry } from "../providers/registry.js";
import { ShippingCache } from "../cache/shipping-cache.js";
import type {
  ShippingRateRequest,
  ShippingRate,
  ShippingMethod,
} from "@repo/types";

export class RateService {
  static async calculateRates(
    request: ShippingRateRequest,
  ): Promise<{ currency: string; rates: ShippingRate[] }> {
    const country = request.country ?? "PK";
    const totalWeight =
      request.weight ??
      request.items?.reduce(
        (sum, item) => sum + (item.weight ?? 0.5) * (item.quantity ?? 1),
        0,
      ) ??
      1.0;

    const isCod = Boolean(request.isCod);
    const computedCodAmount =
      request.codAmount ??
      request.items?.reduce(
        (sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 1),
        0,
      ) ??
      0;

    // Check Redis cache
    const cached = await ShippingCache.getCachedRates(
      request.city,
      country,
      totalWeight,
      isCod,
      computedCodAmount,
    );
    if (cached && cached.length > 0) {
      return { currency: "PKR", rates: cached };
    }

    // Fetch from all active carriers via ProviderRegistry
    const rates = await ProviderRegistry.aggregateRates({
      ...request,
      country,
      weight: totalWeight,
      isCod,
      codAmount: computedCodAmount,
    });

    // Cache results
    await ShippingCache.setCachedRates(
      request.city,
      country,
      totalWeight,
      rates,
      isCod,
      computedCodAmount,
    );

    return { currency: "PKR", rates };
  }

  static async getMethods(): Promise<ShippingMethod[]> {
    await ShipmentRepository.seedDefaultMethodsIfEmpty();
    const methods = await ShipmentRepository.getActiveShippingMethods();
    return methods.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      carrier: m.carrier,
      description: m.description,
      isActive: m.isActive,
      baseRate: m.baseRate,
      estimatedDaysMin: m.estimatedDaysMin,
      estimatedDaysMax: m.estimatedDaysMax,
    }));
  }
}
