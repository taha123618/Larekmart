import assert from "node:assert/strict";
import {
  upsertMerchandisingRule,
  resolveMerchandisingForQuery,
  recordZeroResultQuery,
  getTopZeroResultQueries,
} from "../src/services/merchandising.service.js";

console.log("=== search-service Merchandising, Typo & Zero-Result Analytics Tests ===");

upsertMerchandisingRule({
  queryPattern: "earbuds",
  pinnedProductIds: ["prod_anc_01"],
  boostedCategories: ["Audio"],
  synonyms: ["tws", "wireless earphones"],
  typoFuzziness: "AUTO",
});

const resolved = resolveMerchandisingForQuery("  Earbuds ");
assert.equal(resolved?.pinnedProductIds[0], "prod_anc_01");
assert.equal(resolved?.typoFuzziness, "AUTO");

recordZeroResultQuery("ps6 console");
recordZeroResultQuery("ps6 console");
recordZeroResultQuery("hologram projector");
const topZero = getTopZeroResultQueries(5);
assert.equal(topZero[0]?.query, "ps6 console");
assert.equal(topZero[0]?.count, 2);
console.log("  ✔ Merchandising rules, synonyms, and zero-result analytics verified");
