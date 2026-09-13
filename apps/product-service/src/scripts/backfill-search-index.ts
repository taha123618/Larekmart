/**
 * CLI entry point for the OpenSearch search-index backfill.
 *
 * Republishing the catalog as `product.updated` makes search-service rebuild
 * every document with the image/size/colour fields that older documents lack.
 * search-service must be running (or its consumer must catch up) for the
 * events to be indexed.
 *
 * Usage:
 *   pnpm --filter product-service backfill:search
 *   pnpm --filter product-service backfill:search -- --limit=200 --dry-run
 *   pnpm --filter product-service backfill:search -- --after-id=1500
 */
import { backfillSearchIndex } from "../search/backfill.js";

const args = process.argv.slice(2);

const readArg = (name: string): string | undefined => {
  const inline = args.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(`--${name}=`.length);

  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const readNumberArg = (name: string): number | undefined => {
  const raw = readArg(name);
  if (raw === undefined) return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(`Ignoring invalid --${name} value: ${raw}`);
    return undefined;
  }

  return parsed;
};

const main = async () => {
  const dryRun = args.includes("--dry-run");

  console.log(
    dryRun
      ? "Search backfill (dry run): no events will be published."
      : "Search backfill: republishing catalog products as product.updated...",
  );

  const result = await backfillSearchIndex({
    batchSize: readNumberArg("batch-size"),
    limit: readNumberArg("limit"),
    afterId: readNumberArg("after-id"),
    dryRun,
  });

  console.log(
    `Done. read=${result.processed} published=${result.published} failed=${result.failed}`,
  );

  if (result.hasMore) {
    console.log(
      `Stopped early (limit reached). Resume with: --after-id=${result.nextAfterId}`,
    );
  }

  if (result.failed > 0) {
    console.error(
      "Some products could not be published; re-run to retry them.",
    );
  }

  process.exit(result.failed > 0 ? 1 : 0);
};

main().catch((error) => {
  console.error("Search backfill failed:", error);
  process.exit(1);
});
