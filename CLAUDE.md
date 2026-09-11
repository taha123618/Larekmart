# CLAUDE.md

The canonical, cross-agent instructions for this repository live in
**[`AGENTS.md`](./AGENTS.md)**. Read that file first; it defines what Larekmart is,
the workspace map, the golden rules, commands, and the instruction hierarchy.

## Claude Code Specifics

- **Instruction Hierarchy:**
  1. Root Rules: [`AGENTS.md`](./AGENTS.md)
  2. Global Skills: `.agents/skills/<skill>/SKILL.md`
  3. Workspace Rules: `apps/*/AGENTS.md`, `packages/*/AGENTS.md`
  4. Workspace Skills: `<workspace>/.agents/skills/<skill>/SKILL.md`
- Load the root `AGENTS.md`, then the `AGENTS.md` of the workspace you are editing.
- Task-focused detail lives in skills. Load one by name when relevant to the current task.
- Do not duplicate rules into this file. If a rule changes, edit `AGENTS.md` (and the
  scoped file it belongs to) so every agent stays in sync.
- This repo is a pnpm 9 + Turborepo monorepo. Use `pnpm`, not npm or yarn, and prefer
  `pnpm --filter <workspace> ...` for scoped commands.
- **Verification:** Run `pnpm check-types` across workspaces, plus `pnpm build` (Next apps,
  payment-service) and `pnpm lint` (admin, client) where they apply. When adding tests,
  follow [`docs/TESTING.md`](./docs/TESTING.md).
