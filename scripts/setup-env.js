#!/usr/bin/env node

/**
 * Cross-platform environment file setup script.
 * Discovers every `.env.example` in `apps/*` and `packages/*` (and root),
 * and creates the corresponding `.env` file if it does not already exist.
 *
 * Note: existing `.env` files are never modified or merged. When a new
 * variable is added to a workspace (e.g. media-service's
 * `MEDIA_WORKER_STALE_JOB_SECONDS`), re-run `pnpm run env:setup` after
 * deleting that workspace's `.env`, or diff your `.env` against its
 * `.env.example` manually.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const scanDirs = ["apps", "packages", "."];

function findEnvExamples(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, .turbo, .next, dist, build, generated
      if (
        [
          "node_modules",
          ".git",
          ".turbo",
          ".next",
          "dist",
          "build",
          "generated",
        ].includes(entry.name)
      ) {
        continue;
      }
      findEnvExamples(fullPath, fileList);
    } else if (entry.isFile() && entry.name === ".env.example") {
      fileList.push(fullPath);
    }
  }

  return fileList;
}

function main() {
  console.log("==========================================");
  console.log(" Larekmart Monorepo .env Setup");
  console.log("==========================================\n");

  const envExamples = [];
  for (const scanDir of scanDirs) {
    const targetDir = path.join(rootDir, scanDir);
    if (scanDir === ".") {
      const rootExample = path.join(rootDir, ".env.example");
      if (fs.existsSync(rootExample)) {
        envExamples.push(rootExample);
      }
    } else {
      findEnvExamples(targetDir, envExamples);
    }
  }

  // Deduplicate in case root was scanned multiple times
  const uniqueExamples = [...new Set(envExamples)];

  if (uniqueExamples.length === 0) {
    console.log("No .env.example files discovered.\n");
    return;
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (const examplePath of uniqueExamples) {
    const targetDir = path.dirname(examplePath);
    const envPath = path.join(targetDir, ".env");
    const relExample = path.relative(rootDir, examplePath);
    const relEnv = path.relative(rootDir, envPath);

    if (fs.existsSync(envPath)) {
      console.log(`  [SKIPPED] ${relEnv} (already exists)`);
      skippedCount++;
    } else {
      fs.copyFileSync(examplePath, envPath);
      console.log(`  [CREATED] ${relEnv} (from ${relExample})`);
      createdCount++;
    }
  }

  console.log("\n------------------------------------------");
  console.log(
    `Summary: ${createdCount} created, ${skippedCount} skipped (${uniqueExamples.length} total found).`,
  );
  console.log("==========================================\n");
}

main();
