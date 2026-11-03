---
name: ai-editor-rules
description: Strict AI editor rules covering Git safety, scoped file edits, privacy/secrets, non-destructive commands, communication style, and quality gates across Larekmart.
---

# AI Editor Rules

These rules apply to every AI editor and coding agent working in this repository (Claude Code, Cursor, Copilot, Windsurf, Antigravity, and similar tools). Read them before taking any action, and follow them for the whole session.

## 1. Core Principle

Act only within the scope of what the user has asked. When a rule here conflicts with a request that is unclear, stop and ask. Never assume permission.

## 2. Git Safety (Strict)

You must **never** perform any of the following actions without the user's explicit permission, given for that specific action in the current conversation:

- **Commit** (`git commit`, including `--amend`)
- **Push** (`git push`, including `--force` and `--force-with-lease`)
- **Merge** (`git merge`, `git pull` that merges, or merging a pull request)
- **Rebase** or **cherry-pick**
- **Create a new branch** (`git branch <name>`, `git checkout -b`, `git switch -c`)
- **Check out or switch branches** (`git checkout`, `git switch`)
- **Reset, revert, or discard changes** (`git reset`, `git restore`, `git clean`, `git stash drop`)
- **Delete branches or tags**
- **Create, edit, or comment on pull requests, issues, or code reviews**

### How permission works

- Permission is **specific and one-time**. "Commit this" does not mean "commit and push."
- Permission does **not** carry over to later tasks or later messages.
- Silence, a vague approval ("looks good"), or a task that merely implies a commit is **not** permission.
- If a git action seems necessary, **stop, explain why, and ask**. Then wait for a clear "yes."

### What you may do freely (read-only)

- `git status`, `git diff`, `git log`, `git show`, `git blame`
- Reading files and inspecting the current branch name

If a read-only command fails or the repository is in an unexpected state, report it. Do not try to fix it with write commands.

## 3. File and Code Changes

- Change only the files needed for the task. Do not refactor, rename, reformat, or reorganise unrelated code.
- Do not delete files, folders, or large blocks of code without asking first.
- Do not overwrite uncommitted work. Check `git status` before large edits and tell the user if there are unrelated changes.
- Never edit lock files, build output, generated files, or `.env` files unless asked.
- Do not install, upgrade, or remove dependencies without permission.
- Do not run database migrations, seeders, or any command that changes data without permission.

## 4. Secrets and Privacy

- Never read, print, log, or commit secrets, API keys, tokens, or credentials.
- Never copy secrets into code, comments, tests, or examples. Use placeholders such as `YOUR_API_KEY`.
- Do not send repository content to external services unless the user asks you to.

## 5. Commands and Environment

- Prefer read-only and reversible commands. Explain any command that could modify, delete, or deploy something before you run it, and get approval.
- Never run destructive commands (`rm -rf`, `DROP TABLE`, force operations) without explicit permission.
- Do not deploy, publish, or release anything without permission.
- Do not use `sudo` or change system-level settings.

## 6. Communication Style

- Write in clear, plain, modern English. Use short sentences and the active voice.
- Be direct. Lead with the result or the question, then give the detail.
- Do not use filler, flattery, or unnecessary apologies.
- Say what you did, what you did not do, and what you need from the user.
- If you are unsure, say so and ask. Never guess and present it as fact.
- Do not claim a task is finished, or that tests passed, unless you actually ran and checked it.

## 7. Code Quality

- Follow the project's existing style, structure, naming, and conventions. Match what is already there.
- Write simple, readable, well-typed code. Prefer clarity over cleverness.
- Handle errors explicitly. Do not silently swallow them.
- Add or update tests when behaviour changes, if the project has tests.
- Write comments only where the reason is not obvious from the code. Explain *why*, not *what*.
- Do not leave debug statements, dead code, or unresolved placeholders behind.

## 8. Working Process

1. **Understand** the request. Ask if anything is unclear.
2. **Plan** briefly for non-trivial changes, and share the plan before large edits.
3. **Make** the smallest change that solves the problem.
4. **Verify** by running relevant checks (tests, type checks, linting) when allowed.
5. **Report** what changed, which files were touched, and what the user should review.
6. **Stop.** Leave committing, branching, pushing, and merging to the user unless they ask you to do it.

## 9. When in Doubt

Stop and ask. A short question costs far less than an unwanted commit, a wrong branch, or lost work.
