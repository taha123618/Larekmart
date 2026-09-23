import type {
  ShippingProvider,
  ShippingRateRequest,
  ShippingRate,
} from "./interface.js";
import { CustomShippingProvider } from "./custom/custom.provider.js";
import { TcsShippingProvider } from "./tcs/tcs.provider.js";
import { LeopardsShippingProvider } from "./leopards/leopards.provider.js";
import { DhlShippingProvider } from "./dhl/dhl.provider.js";
import { FedexShippingProvider } from "./fedex/fedex.provider.js";

export class ProviderRegistry {
  private static providers: Map<string, ShippingProvider> = new Map();

  static initialize(): void {
    const list: ShippingProvider[] = [
      new CustomShippingProvider(),
      new TcsShippingProvider(),
      new LeopardsShippingProvider(),
      new DhlShippingProvider(),
      new FedexShippingProvider(),
    ];

    for (const provider of list) {
      this.providers.set(provider.carrierCode.toLowerCase(), provider);
    }
  }

  static getProvider(carrier: string): ShippingProvider {
    if (this.providers.size === 0) {
      this.initialize();
    }
    const normalized = carrier.toLowerCase().trim();
    const provider = this.providers.get(normalized);
    if (!provider) {
      throw new Error(`Shipping provider for carrier '${carrier}' not found`);
    }
    return provider;
  }

  static getAllProviders(): ShippingProvider[] {
    if (this.providers.size === 0) {
      this.initialize();
    }
    return Array.from(this.providers.values());
  }

  static async aggregateRates(
    request: ShippingRateRequest,
  ): Promise<ShippingRate[]> {
    const providers = this.getAllProviders();
    const promises = providers.map(async (p) => {
      try {
        return await p.getRates(request);
      } catch (err) {
        console.warn(
          `[ProviderRegistry] Failed to fetch rates from ${p.carrierCode}:`,
          err,
        );
        return [];
      }
    });

    const results = await Promise.all(promises);
    return results.flat();
  }
}
