---
name: documentation
description: Use when creating or updating documentation, AGENTS.md files, skills, ADRs, READMEs, or docs/ pages in Larekmart — to decide the correct location and scope.
---

# Documentation

Documentation is **scoped**, like the code. Put content at the narrowest scope that
owns it; don't centralize everything in one file.

## Map

| Location                                                          | Scope          | Use for                                                                      |
| ----------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| `README.md`                                                       | whole repo     | product overview, setup, commands, stack                                     |
| `docs/`                                                           | whole repo     | architecture, events, dependencies, conventions, API, testing, AI guidelines |
| `docs/adr/`                                                       | whole repo     | durable decisions and their rationale                                        |
| `CONTRIBUTING.md`                                                 | whole repo     | contribution workflow                                                        |
| `AGENTS.md` (root)                                                | all agents     | rules, boundaries, commands, instruction hierarchy                           |
| `.agents/skills/*`                                                | root tasks     | cross-cutting task playbooks                                                 |
| `apps/<app>/README.md`                                            | one app        | local setup, routes, env                                                     |
| `apps/<app>/AGENTS.md`                                            | one app        | scoped agent rules                                                           |
| `apps/<app>/.agents/skills/*`                                     | one app        | app-specific playbooks                                                       |
| `packages/<pkg>/README.md` / `AGENTS.md` / `.agents/skills/*`     | one package    | package API, rules, playbooks                                                |
| `CLAUDE.md`, `.cursor/rules/*`, `.github/copilot-instructions.md` | editor mirrors | point to `AGENTS.md`; don't fork the rules                                   |

## Rules

- **`AGENTS.md` is the source of truth.** Editor-specific files must defer to it and
  should link rather than duplicate. When a rule changes, update the `AGENTS.md` that
  owns it; mirrors rarely need edits because they delegate.
- **Skills are task-triggered.** A `SKILL.md` starts with YAML frontmatter:
  `name` (matching its directory) and a `description` written as "Use when…" so agents
  can decide whether to load it. Keep one skill per coherent task.
- **READMEs are for humans.** Lead with what the workspace does, then setup, then env.
- **ADRs record the _why_.** Use `docs/adr/NNNN-title.md`, one decision per record,
  status `Proposed | Accepted | Superseded`, and note the alternatives considered.
- **Docs describe reality.** If something isn't implemented (tests, CI, Docker), say so
  plainly rather than documenting an aspiration as fact. This repo currently has no test
  suite and no CI.
- **Keep docs accurate as code changes.** A change to architecture, an event contract, a
  public export, or an env var is incomplete until the owning doc is updated.

## When to update what

| You changed…                           | Update                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| A new/changed service, app, or package | root `README.md` + `AGENTS.md` tables, the workspace README/AGENTS           |
| A Kafka topic or payload               | `docs/EVENT-DRIVEN-ARCHITECTURE.md`, `@repo/types`, the affected `AGENTS.md` |
| A public package export                | the package README                                                           |
| Package dependency direction           | `docs/DEPENDENCIES.md`                                                       |
| An env var                             | the workspace `.env.example` and `docs/DEVELOPMENT.md`                       |
| A cross-cutting convention             | `docs/CONVENTIONS.md` and/or root `AGENTS.md`                                |
| A durable design decision              | a new entry in `docs/adr/`                                                   |
