import { Injectable } from "@nestjs/common";

export interface KybDocumentRenewalRecord {
  renewalId: string;
  vendorId: string;
  documentType: string;
  documentUrl: string;
  expiresAt: string;
  daysRemaining: number;
  reminderTier: "EXPIRED" | "CRITICAL_7D" | "WARNING_30D" | "VALID";
  reverificationRequired: boolean;
  riskReason?: string;
  submittedAt: string;
}

@Injectable()
export class KybRenewalService {
  private readonly renewals = new Map<string, KybDocumentRenewalRecord[]>();

  evaluateKybExpiration(vendorId: string, expiresAtIso: string): {
    vendorId: string;
    daysRemaining: number;
    reminderTier: KybDocumentRenewalRecord["reminderTier"];
    requiresAction: boolean;
  } {
    const msRemaining = new Date(expiresAtIso).getTime() - Date.now();
    const daysRemaining = Math.ceil(msRemaining / 86400_000);

    let reminderTier: KybDocumentRenewalRecord["reminderTier"] = "VALID";
    if (daysRemaining <= 0) reminderTier = "EXPIRED";
    else if (daysRemaining <= 7) reminderTier = "CRITICAL_7D";
    else if (daysRemaining <= 30) reminderTier = "WARNING_30D";

    return {
      vendorId,
      daysRemaining,
      reminderTier,
      requiresAction: reminderTier !== "VALID",
    };
  }

  submitDocumentRenewal(params: {
    vendorId: string;
    documentType: string;
    documentUrl: string;
    expiresAt: string;
    riskScore?: number;
  }): KybDocumentRenewalRecord {
    const evalRes = this.evaluateKybExpiration(params.vendorId, params.expiresAt);
    const highRisk = (params.riskScore ?? 0) >= 70;

    const record: KybDocumentRenewalRecord = {
      renewalId: `kybr_${crypto.randomUUID().slice(0, 12)}`,
      vendorId: params.vendorId,
      documentType: params.documentType,
      documentUrl: params.documentUrl,
      expiresAt: params.expiresAt,
      daysRemaining: evalRes.daysRemaining,
      reminderTier: evalRes.reminderTier,
      reverificationRequired: highRisk,
      riskReason: highRisk ? `Risk score ${params.riskScore} exceeds re-verification threshold (70)` : undefined,
      submittedAt: new Date().toISOString(),
    };

    const existing = this.renewals.get(params.vendorId) ?? [];
    existing.unshift(record);
    this.renewals.set(params.vendorId, existing);
    return record;
  }

  getVendorRenewals(vendorId: string): KybDocumentRenewalRecord[] {
    return this.renewals.get(vendorId) ?? [];
  }
}
