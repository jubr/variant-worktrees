---
name: vw-spec-iterate
description: >
  Implement an OpenSpec change with TDD until local lint/build/tests pass.
  Create logical Conventional Commits while implementing. Use during
  feature development, /vw-spec-iterate, or after /vw-spec-start.
---

# vw-spec-iterate

Implement `$slug` in the feature worktree until local quality gates pass. No push/PR here.

## Hard gate — read IN FULL before implementation

Before writing tests or editing production code, **Read** each file below **in full** (entire file via the Read tool — no skim, no summary-only). Skip nothing. Re-read if session context lost the content.

| Doc                     | Relative path                                   | Why read                                                                  |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| Source-of-truth map     | `AGENTS.md`                                     | Where requirements, design, and docs live; conflict order                 |
| Contributing workflow   | `CONTRIBUTING.md`                               | Outside-in TDD, verification commands, commits, branch/PR, no agent merge |
| Active change artifacts | `openspec/changes/$slug/`                       | proposal, specs, design, tasks for this slice                             |
| Apply-change skill      | `.agents/skills/openspec-apply-change/SKILL.md` | Task-driven implementation loop — do not restate                          |
| TDD skill               | `.agents/skills/tdd/SKILL.md`                   | Red-green-refactor for every testable behavior change                     |

**Violation**: starting implementation without those Reads complete.

### Size check — run before the Reads, again before `Done`

The hard gate reads `openspec/changes/$slug/` in full, so its size is a token cost paid every session. Measure it first (excludes `archive/`):

```bash
find openspec/changes/$slug -type f -exec wc -c {} + | sort -n | tail -n 6
```

Estimate tokens ≈ bytes / 4. Thresholds on the `total` line:

| Total bytes | ≈ Tokens | Action                                                                                                          |
| ----------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| < 60 000    | < 15k    | OK. Silent.                                                                                                     |
| 60 000+     | 15k+     | **WARN** in chat: `⚠ openspec/changes/$slug is ~Nk tokens (X KB). Expensive to read in full.` List 3 biggest files. |
| 120 000+    | 30k+     | **STRONG WARN**: same message, and propose to split the change or trim/merge bloated spec files before continuing. |

On warn: still do the full Reads (gate is not waived), but tell the user and suggest the cheapest fix (split slice into smaller changes, archive finished tasks, dedupe spec/design prose). Never silently trim artifacts — scope changes go through OpenSpec propose/amend.

**Conflict resolution:** When behavioral evidence conflicts, resolve by: observable runtime/deployed contracts → automated tests → application code → historical prose.

**Scope changes:** Expand scope only via OpenSpec artifacts (propose/amend). Do not silently widen the change.

## Tools

- If not in `mise hook-env`: Always `mise x -- …` for `openspec`, `task`, `bun`, and other project tools.
  This applies to all command invocations in this file. Also note `mise` manages env vars for child processes.

## Loop

Phases: **Orient** (AGENTS.md / change artifacts) → **Implement** (skills `tdd` / `openspec-apply-change`) → **Verify** (`task check:changed` or focused `task test` / `task lint`) → **Finish** (`task check:full`, tasks.md checkboxes)

1. Announce `Using change: $slug` (infer from branch/`openspec/changes/` if omitted).
2. If `openspec/changes/$slug` is not commited: do it now.
3. Follow `openspec-apply-change`:
  - pick next incomplete tasks
  - announce in chat with dense oneliner `Picking up task **1.2 Add the schema and export it**`, in list-form if multiple
  - edit `tasks.md` to mark task in progress `[~] 1.2 Add the schema and export it` (working tree only)
  - implement with `tdd`
  - mark tasks done when verified (still working tree only)
  - commit that logical unit as **code/tests only** (see below)
4. Prefer focused `task test` / `task lint` / `task build` while iterating; widen with `task check:changed` (hk scopes to git-changed files). See `Taskfile.yaml`.
5. Before handoff, report, or push: from repo root `task check:full`. Fix failures in-tree and re-run until green. While fixing, prefer `task check:changed` or the specific `task` that failed.
6. Before each commit: from repo root `task format:write`.
7. **Commit while implementing.** Create logical Conventional Commits as work lands — do not wait for the user to ask, and do not leave the whole slice uncommitted for `vw-spec-pipeline`.
  - One commit per coherent unit (typically a completed `tasks.md` task-group if large enough, or single task, or a tightly related group that cannot stand alone).
  - **Never mix OpenSpec artifacts with product code.** Do not stage `openspec/changes/` or `openspec/specs/`. Checkbox edits stay dirty until `vw-spec-wrapup`. Stage explicit paths; never `git add -A` / `git add .`.
  - Format: `type(scope): summary` per `CONTRIBUTING.md`. Focused; no secrets; never `--no-verify`.

## Done when

- OpenSpec tasks for the intended slice are checked off in the working tree (or user accepts remaining work).
- Feature work is committed in logical Conventional Commits on the feature branch — **code/tests only**.
- `task format:write` has run and `task check:full` succeed locally.
- Run `openspec validate --all --strict` and fix any anomalies.
- Re-run the **Size check**; report final size (and any growth since start) in the hand-off.
- After all possible tasks complete: commit possible remaining `openspec/changes/$slug` changes.

## Hand-off

Next: skill `vw-spec-pipeline`. Wrap/archive: skill `vw-spec-wrapup`.
