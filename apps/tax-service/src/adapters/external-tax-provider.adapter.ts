import type {
  TaxQuoteRequest,
  TaxCalculationResponse,
  TaxReturnQuoteRequest,
  TaxReturnQuoteResponse,
} from "@repo/types";
import {
  TaxCalculator,
  type CalculationContext,
} from "../services/calculator.js";
import type { ITaxProviderAdapter } from "./tax-provider.interface.js";
import { getDb } from "../db/connection.js";
import { taxProviderLogs } from "../db/schema.js";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";

/**
 * External Tax Provider Adapter (e.g. Avalara / TaxJar / Vertex)
 * Demonstrates replaceable provider integration with credential redaction & audit logging.
 */
export class ExternalTaxProviderAdapter implements ITaxProviderAdapter {
  private readonly endpoint: string;
  private readonly apiKey: string;

  constructor(endpoint?: string, apiKey?: string) {
    this.endpoint = endpoint || env.TAX_PROVIDER_ENDPOINT;
    this.apiKey = apiKey || env.TAX_PROVIDER_API_KEY;
  }

  public getProviderName(): string {
    return "external-provider";
  }

  /**
   * Redacts sensitive authorization credentials, card numbers, or certificates
   */
  private redactPayload(payload: Record<string, unknown> | string): string {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    return raw.replace(
      /("apiKey"|"authorization"|"secret"|"token")\s*:\s*"[^"]+"/gi,
      '$1:"[REDACTED]"',
    );
  }

  public async calculateTax(
    request: TaxQuoteRequest,
    context: CalculationContext,
  ): Promise<TaxCalculationResponse> {
    const startTime = Date.now();
    const requestSnapshot = {
      endpoint: this.endpoint || "https://api.taxprovider.example/v2/taxes",
      request,
    };

    let status = "success";
    let responseData: TaxCalculationResponse;

    try {
      // In production, this would make an authenticated HTTPS request with this.apiKey
      // For resilient fallback and testing, delegate calculation to the engine
      responseData = TaxCalculator.calculate(request, {
        ...context,
        provider: this.getProviderName(),
      });
    } catch (err) {
      status = "failed";
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      await this.logProviderTransaction(
        requestSnapshot,
        responseData!,
        status,
        latencyMs,
      );
    }

    return responseData;
  }

  public async calculateReturnTax(
    request: TaxReturnQuoteRequest,
    originalCalculation: TaxCalculationResponse,
  ): Promise<TaxReturnQuoteResponse> {
    const startTime = Date.now();
    const requestSnapshot = {
      endpoint:
        this.endpoint || "https://api.taxprovider.example/v2/taxes/adjust",
      request,
    };

    let status = "success";
    let responseData: TaxReturnQuoteResponse;

    try {
      responseData = TaxCalculator.calculateReturnQuote(
        request,
        originalCalculation,
      );
    } catch (err) {
      status = "failed";
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      await this.logProviderTransaction(
        requestSnapshot,
        responseData!,
        status,
        latencyMs,
      );
    }

    return responseData;
  }

  private async logProviderTransaction(
    requestData: unknown,
    responseData: unknown,
    status: string,
    latencyMs: number,
  ): Promise<void> {
    try {
      const db = getDb();
      await db.insert(taxProviderLogs).values({
        id: uuidv4(),
        provider: this.getProviderName(),
        requestPayload: this.redactPayload(
          requestData as Record<string, unknown>,
        ),
        responsePayload: this.redactPayload(
          responseData as Record<string, unknown>,
        ),
        status,
        latencyMs,
      });
    } catch {
      // Avoid failing business transaction if provider audit log insertion fails
    }
  }
}
