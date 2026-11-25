import { z } from "zod";

export interface MerchandisingRule {
  ruleId: string;
  queryPattern: string;
  pinnedProductIds: string[];
  boostedCategories: string[];
  synonyms: string[];
  typoFuzziness: "AUTO" | "0" | "1" | "2";
  updatedAt: string;
}

export interface ZeroResultRecord {
  query: string;
  count: number;
  lastSeenAt: string;
}

export const MerchandisingRuleSchema = z.object({
  queryPattern: z.string().min(1).max(128),
  pinnedProductIds: z.array(z.string()).default([]),
  boostedCategories: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  typoFuzziness: z.enum(["AUTO", "0", "1", "2"]).default("AUTO"),
});

const merchandisingRules = new Map<string, MerchandisingRule>();
const zeroResultCounts = new Map<string, ZeroResultRecord>();

export function upsertMerchandisingRule(
  input: z.infer<typeof MerchandisingRuleSchema>,
): MerchandisingRule {
  const key = input.queryPattern.trim().toLowerCase();
  const rule: MerchandisingRule = {
    ruleId: `mrule_${crypto.randomUUID().slice(0, 10)}`,
    queryPattern: key,
    pinnedProductIds: input.pinnedProductIds,
    boostedCategories: input.boostedCategories,
    synonyms: input.synonyms,
    typoFuzziness: input.typoFuzziness,
    updatedAt: new Date().toISOString(),
  };
  merchandisingRules.set(key, rule);
  return rule;
}

export function resolveMerchandisingForQuery(query: string): MerchandisingRule | null {
  return merchandisingRules.get(query.trim().toLowerCase()) ?? null;
}

export function recordZeroResultQuery(query: string): ZeroResultRecord {
  const normalized = query.trim().toLowerCase();
  const existing = zeroResultCounts.get(normalized);
  const record: ZeroResultRecord = {
    query: normalized,
    count: (existing?.count ?? 0) + 1,
    lastSeenAt: new Date().toISOString(),
  };
  zeroResultCounts.set(normalized, record);
  return record;
}

export function getTopZeroResultQueries(limit = 20): ZeroResultRecord[] {
  return Array.from(zeroResultCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
