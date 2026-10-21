---
name: vw-spec-start
description: >
  Bootstrap a variant-worktrees OpenSpec change: kebab slug, worktree/branch,
  propose artifacts. Use when starting a new feature/spec slice,
  /vw-spec-start $slug
---

# vw-spec-start

Bootstrap one OpenSpec change `$slug` (kebab-case). For slugs, prefer a prefix similar to existing `openspec/changes/archive/*` for sortability. Planning + workspace only. Stop when propose artifacts exist. Do not implement product code here.

**MUST DO FIRST**: **Initial chat** title should be `$slug`

## Hard gate — read IN FULL before any work

Before proposing, branching, or writing tests/code, **Read** each file below **in full** (entire file via the Read tool — no skim, no summary-only). Skip nothing. Re-read if session context lost the content.

| Doc                   | Relative path                              | Why read                                                                  |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| Source-of-truth map   | `AGENTS.md`                                | Where requirements, design, and docs live; conflict order                 |
| Contributing workflow | `CONTRIBUTING.md`                          | Outside-in TDD, verification commands, commits, branch/PR, no agent merge |
| Propose skill         | `.agents/skills/openspec-propose/SKILL.md` | Change creation protocol — do not duplicate its steps                     |

**Violation**: starting without those three Reads complete.

If scope is unclear before proposing, MUST read skill `openspec-explore` first.

## Tools

- If not in `mise hook-env`: Always `mise x -- …` for `openspec`, `task`, `bun`, and other project tools.
  This applies to all command invocations in this file. Also note `mise` manages env vars for child processes.
- Install missing tools with `mise trust .` + `mise install` from the checkout root.

## Steps

1. **Resolve** `$slug`**.** User supplies kebab name, or derive from the request. Announce: `Using change: $slug` (override: re-run with another slug).
2. **Rename chat** title / session name to `$slug` when the client supports it.
3. **Sync base.** From the main product checkout (not a dirty feature worktree): `git fetch` + `git pull --ff-only` on `main`.
4. **Worktree + branch.** Create sibling worktree `_v-$slug` on branch `feat/$slug` or `fix/$slug` from updated `main` when not already on that branch/worktree. `cd` into it for all later work.
5. **Tooling.** `mise install` if needed. Ensure workspace deps exist (`task install`).
6. **GitHub CLI.** Ensure `gh` is authenticated before later PR/pipeline work: `gh auth status`. Do not commit tokens.
7. **Propose.** Follow skill `openspec-propose` with change name `$slug`. Wait for an explicit apply/iterate request before coding.
8. **Commit the change.** One Conventional Commit containing only `openspec/changes/$slug/` (proposal, design, delta specs, `tasks.md` as planned). No product code. This is the first OpenSpec commit. Wrapup later commits leftover `tasks.md` checkboxes if needed, then a separate **sync-archive** commit on this **same** feature branch.

Report in chat contains markdown links that open the [proposal.md](http://proposal.md) & friends in the editor in the correct worktree.

## Hand-off

Next: skill `vw-spec-iterate`. Pipeline/PR is skill `vw-spec-pipeline`. Sync-archive and cleanup are skill `vw-spec-wrapup` on this same feature branch.
