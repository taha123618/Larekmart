import { env } from "../config/env.js";
import type { ITaxProviderAdapter } from "./tax-provider.interface.js";
import { StandardTaxEngineAdapter } from "./standard-tax-engine.adapter.js";
import { ExternalTaxProviderAdapter } from "./external-tax-provider.adapter.js";

/**
 * Tax Provider Factory
 * Resolves the configured tax adapter based on environment or jurisdiction rules.
 */
export class TaxProviderFactory {
  private static standardAdapter: ITaxProviderAdapter =
    new StandardTaxEngineAdapter();
  private static externalAdapter: ITaxProviderAdapter =
    new ExternalTaxProviderAdapter();

  public static getProvider(providerType?: string): ITaxProviderAdapter {
    const selected = providerType || env.TAX_PROVIDER;
    if (selected === "external") {
      return this.externalAdapter;
    }
    return this.standardAdapter;
  }
}
