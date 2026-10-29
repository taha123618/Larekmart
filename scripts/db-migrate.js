#!/usr/bin/env node

/**
 * Larekmart Monorepo - Sequential Database Migration Orchestrator
 *
 * Enforces strict topological dependency order across all 14 database workspaces
 * sharing the central database cluster (PostgreSQL & MySQL), eliminating
 * table-locking race conditions, catalog deadlocks, and out-of-order schema syncs.
 *
 * Dependency Order Stages:
 *   Stage 1: Foundational Master Entities (product-db, inventory-db, user-db, vendor-db)
 *   Stage 2: Operational & Transactional (shipping-db, media-service, pricing-service, promotion-service, tax-service, return-service)
 *   Stage 3: Read Projections, Storefronts & Interactions (catalog-db, seller-service, review-service, wishlist-service)
 *
 * Usage:
 *   node scripts/db-migrate.js --action=migrate   # Development schema sync (default)
 *   node scripts/db-migrate.js --action=deploy    # Production deterministic deployment
 *   node scripts/db-migrate.js --action=status    # Check migration status across databases
 *   node scripts/db-migrate.js --stage=1          # Run specific stage only
 *   node scripts/db-migrate.js --workspace=@repo/product-db # Target single workspace
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// ─────────────────────────────────────────────────────────────────────────────
// Topological Migration Dependency Hierarchy
// ─────────────────────────────────────────────────────────────────────────────
export const MIGRATION_STAGES = [
  {
    stage: 1,
    name: "Master Entity & Foundational Domains",
    description: "Core data models referenced as sources of truth across the cluster",
    targets: [
      {
        name: "@repo/product-db",
        type: "prisma",
        cwd: "packages/product-db",
        database: "product_db (PostgreSQL)",
      },
      {
        name: "@repo/inventory-db",
        type: "prisma",
        cwd: "packages/inventory-db",
        database: "inventory_db (PostgreSQL)",
      },
      {
        name: "@repo/user-db",
        type: "prisma",
        cwd: "packages/user-db",
        database: "user_db (PostgreSQL)",
      },
      {
        name: "@repo/vendor-db",
        type: "prisma",
        cwd: "packages/vendor-db",
        database: "vendor_db (PostgreSQL)",
      },
    ],
  },
  {
    stage: 2,
    name: "Operational & Transactional Services",
    description: "Domain-specific operational pipelines, media, pricing, promotions, and tax workflows",
    targets: [
      {
        name: "@repo/shipping-db",
        type: "prisma",
        cwd: "packages/shipping-db",
        database: "shipping_db (PostgreSQL)",
      },
      {
        name: "media-service",
        type: "drizzle",
        cwd: "apps/media-service",
        database: "media_db (PostgreSQL)",
      },
      {
        name: "pricing-service",
        type: "drizzle",
        cwd: "apps/pricing-service",
        database: "pricing_db (PostgreSQL)",
      },
      {
        name: "promotion-service",
        type: "drizzle",
        cwd: "apps/promotion-service",
        database: "promotion_db (PostgreSQL)",
      },
      {
        name: "tax-service",
        type: "drizzle",
        cwd: "apps/tax-service",
        database: "tax_db (MySQL)",
      },
      {
        name: "return-service",
        type: "drizzle",
        cwd: "apps/return-service",
        database: "return_db (MySQL)",
      },
    ],
  },
  {
    stage: 3,
    name: "Read Projections, Storefronts & Downstream Consumers",
    description: "Read-optimized projection read-models and consumer interactivity tables",
    targets: [
      {
        name: "@repo/catalog-db",
        type: "prisma",
        cwd: "packages/catalog-db",
        database: "catalog_db (PostgreSQL)",
        note: "Catalog projections MUST sync AFTER product-db entities are locked and verified",
      },
      {
        name: "seller-service",
        type: "drizzle",
        cwd: "apps/seller-service",
        database: "seller_db (PostgreSQL)",
        note: "Seller storefront tables depend on upstream vendor_db entities",
      },
      {
        name: "review-service",
        type: "drizzle",
        cwd: "apps/review-service",
        database: "review_db (PostgreSQL)",
      },
      {
        name: "wishlist-service",
        type: "drizzle",
        cwd: "apps/wishlist-service",
        database: "wishlist_db (PostgreSQL)",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Argument Parsing & CLI Options
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let action = "migrate"; // migrate | deploy | status
  let targetWorkspace = null;
  let targetStage = null;
  let continueOnError = false;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--action=")) {
      action = arg.split("=")[1];
    } else if (arg.startsWith("--workspace=")) {
      targetWorkspace = arg.split("=")[1];
    } else if (arg.startsWith("-w=")) {
      targetWorkspace = arg.split("=")[1];
    } else if (arg.startsWith("--stage=")) {
      targetStage = Number.parseInt(arg.split("=")[1], 10);
    } else if (arg === "--continue-on-error") {
      continueOnError = true;
    }
  }

  if (!["migrate", "deploy", "status"].includes(action)) {
    console.error(`[Error] Invalid action: "${action}". Valid options: migrate | deploy | status`);
    process.exit(1);
  }

  return { action, targetWorkspace, targetStage, continueOnError };
}

function printHelp() {
  console.log(`
Larekmart Sequential Database Migration Orchestrator

Usage:
  node scripts/db-migrate.js [options]
  pnpm db:migrate
  pnpm db:deploy
  pnpm db:status

Options:
  --action=<migrate|deploy|status>  Execution mode (default: migrate)
                                      migrate = 'db:migrate' (dev diff & sync)
                                      deploy  = 'db:deploy' (production deterministic)
                                      status  = check migration status
  --stage=<1|2|3>                   Execute only targets in the specified stage
  --workspace=<name>                Execute only for a specific workspace (e.g. @repo/product-db)
  --continue-on-error               Do not abort entire pipeline on individual failure
  -h, --help                        Show this help message
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration Runner
// ─────────────────────────────────────────────────────────────────────────────
function runCommand(command, args, cwd) {
  const isWindows = process.platform === "win32";
  const cmd = isWindows ? `${command}.cmd` : command;
  return spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env },
  });
}

function resolveCommand(target, action) {
  if (action === "status") {
    if (target.type === "prisma") {
      return { command: "pnpm", args: ["--filter", target.name, "exec", "prisma", "migrate", "status"] };
    }
    return { command: "pnpm", args: ["--filter", target.name, "db:migrate"] };
  }

  if (action === "deploy") {
    return { command: "pnpm", args: ["--filter", target.name, "db:deploy"] };
  }

  // action === 'migrate'
  return { command: "pnpm", args: ["--filter", target.name, "db:migrate"] };
}

async function main() {
  const { action, targetWorkspace, targetStage, continueOnError } = parseArgs();

  console.log("================================================================================");
  console.log(` 🛡️  Larekmart Database Migration Orchestrator`);
  console.log(` Action:    [${action.toUpperCase()}]`);
  console.log(` Mode:      Sequential Topological Execution (Anti-Lock Race Prevention)`);
  if (targetStage) console.log(` Stage:     Stage ${targetStage} only`);
  if (targetWorkspace) console.log(` Target:    Workspace "${targetWorkspace}"`);
  console.log("================================================================================\n");

  const startTime = Date.now();
  let totalMigrated = 0;
  let totalFailed = 0;
  const stageResults = [];

  for (const stage of MIGRATION_STAGES) {
    if (targetStage && stage.stage !== targetStage) {
      continue;
    }

    // Filter targets for this stage if workspace targeted
    let stageTargets = stage.targets;
    if (targetWorkspace) {
      stageTargets = stageTargets.filter(
        (t) => t.name === targetWorkspace || t.cwd.endsWith(targetWorkspace)
      );
      if (stageTargets.length === 0) continue;
    }

    console.log(`────────────────────────────────────────────────────────────────────────────────`);
    console.log(`► STAGE ${stage.stage}: ${stage.name}`);
    console.log(`  ${stage.description}`);
    console.log(`────────────────────────────────────────────────────────────────────────────────`);

    for (const target of stageTargets) {
      console.log(`\n[${target.name}] → Database: ${target.database}`);
      if (target.note) {
        console.log(`  ℹ  Order Rationale: ${target.note}`);
      }

      const { command, args } = resolveCommand(target, action);
      console.log(`  $ ${command} ${args.join(" ")}`);

      const targetStart = Date.now();
      const result = runCommand(command, args, rootDir);
      const targetDuration = ((Date.now() - targetStart) / 1000).toFixed(2);

      if (result.status === 0) {
        console.log(`  ✓ [${target.name}] Successfully executed in ${targetDuration}s`);
        totalMigrated++;
        stageResults.push({ name: target.name, success: true, duration: targetDuration });
      } else {
        console.error(`  ✗ [${target.name}] FAILED with exit code ${result.status} (${targetDuration}s)`);
        totalFailed++;
        stageResults.push({ name: target.name, success: false, duration: targetDuration, code: result.status });

        if (!continueOnError) {
          console.error(`\n[FATAL] Halting migration pipeline due to failure in [${target.name}].`);
          console.error(`Subsequent dependent schemas will NOT be migrated to prevent corruption.`);
          process.exit(result.status || 1);
        }
      }
    }

    console.log(`\n  ✔ Stage ${stage.stage} complete.\n`);
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("================================================================================");
  console.log(` 🏁 Migration Orchestrator Summary`);
  console.log(` Total Targets: ${totalMigrated + totalFailed}`);
  console.log(` Succeeded:     ${totalMigrated}`);
  console.log(` Failed:        ${totalFailed}`);
  console.log(` Total Time:    ${totalDuration}s`);
  console.log("================================================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[FATAL] Unexpected error in migration orchestrator:", err);
  process.exit(1);
});

