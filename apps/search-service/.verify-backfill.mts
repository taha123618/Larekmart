import { SearchBackfillRequestSchema } from "@repo/types";

const window = SearchBackfillRequestSchema.parse({
  afterId: undefined,
  batchSize: 200,
  timeBudgetMs: 20000,
});
console.log("admin window body :", JSON.stringify(window));

const csv = SearchBackfillRequestSchema.parse({ afterId: "150", dryRun: "true", limit: "5" });
console.log("string coercion   :", JSON.stringify(csv));

console.log("empty body        :", JSON.stringify(SearchBackfillRequestSchema.parse({})));

const bad = SearchBackfillRequestSchema.safeParse({ batchSize: 0, timeBudgetMs: 999999 });
console.log("invalid rejected  :", bad.success === false);
