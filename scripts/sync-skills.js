#!/usr/bin/env node

/**
 * Cross-platform AI Coding-Agent Skills Synchronization script.
 * Synchronizes the canonical AI skills from `.agents/skills/*` to supported
 * AI assistant configuration directories (`.cursor/skills`, `.claude/skills`,
 * `.gemini/skills`, `.github/skills`).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourceSkillsDir = path.join(rootDir, ".agents", "skills");

const targetDirs = [
  path.join(rootDir, ".cursor", "skills"),
  path.join(rootDir, ".claude", "skills"),
  path.join(rootDir, ".gemini", "skills"),
  path.join(rootDir, ".github", "skills"),
];

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  console.log("==========================================");
  console.log(" Larekmart AI Skills Synchronization");
  console.log("==========================================\n");

  if (!fs.existsSync(sourceSkillsDir)) {
    console.error(
      `Error: Source skills directory not found at ${path.relative(rootDir, sourceSkillsDir)}`,
    );
    process.exit(1);
  }

  const skills = fs
    .readdirSync(sourceSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  console.log(
    `Canonical source: .agents/skills/ (${skills.length} skills found)\n`,
  );

  for (const targetDir of targetDirs) {
    const relTarget = path.relative(rootDir, targetDir);
    try {
      copyDirRecursive(sourceSkillsDir, targetDir);
      console.log(
        `  [SYNCED] .agents/skills/  ──▶  ${relTarget}/ (${skills.length} skills)`,
      );
    } catch (err) {
      console.error(`  [ERROR] Failed to sync to ${relTarget}:`, err.message);
    }
  }

  console.log("\n------------------------------------------");
  console.log(
    `Synchronization complete across all target AI agent directories.`,
  );
  console.log("==========================================\n");
}

main();
