# Contributing

## Before changing behavior

1. Read [`AGENTS.md`](AGENTS.md) and the relevant current capability under
   `openspec/specs/`.
2. Create or select an OpenSpec change under `openspec/changes/`.
3. Keep a change focused. Record product behavior in specs; keep VitePress
   `docs/` as user-facing library/MCP documentation, not a behavior spec.

## Citing a specification

Source comments, documentation, and specs cite the **published** location under
`openspec/specs/<capability-path>/spec.md`, never the change directory a delta
was drafted in. A change directory moves to `openspec/changes/archive/` when the
change is sync-archived, so a citation pointing at it goes stale on sync-archive
day. Cite where the requirement will live, not where it was written — the path
is the same capability path the delta declares, so it is known before the change
is sync-archived.

In markdown use a relative link, labelled by capability:

```markdown
[specs/<category>/<capability>](../../openspec/specs/<category>/<capability>/spec.md)
[specs/<category>/<capability> | Heading Link](../../openspec/specs/<category>/<capability>/spec.md#heading-link)
```

Count the `../` segments from the citing file's own directory. In code, a plain
path in a comment is enough:

```ts
/**
 * Specification: openspec/specs/<category>/<capability>/spec.md
 */
```

Referring to `openspec/changes/` as a directory, or to a change's `proposal.md`,
`design.md`, or `tasks.md`, is unaffected — those artifacts belong to the change
and are read where the change lives.

## Outside-in TDD

Behavior changes follow red-green-refactor:

1. Add a failing high-level test for the observable behavior.
2. Add narrower failing tests where they help isolate domain logic.
3. Implement the smallest change that makes the tests pass.
4. Refactor while the focused tests stay green.
5. When all tasks that can be completed in a task-group are green: make single task-group code+tests commit.
   Don't batch all work into one commit at end.

Use present-tense test names that describe behavior. Co-locate `bun:test` files
with their source as `{file}.spec.ts` (for example, `src/client.ts` and
`src/client.spec.ts`). Prefer public API round-trips (`createClient().free`,
MCP tool handlers) over private internals. Zod schemas are the source of truth
for response types.

Documentation-only baseline changes do not require new product tests, but they
must run the existing checks cited as evidence by the selected OpenSpec change.

## Tool execution

**All commands** and project tools (`openspec`, `task`, `bun`, `hk`, `commitlint`, etc)
should use mise-managed versions.
**AI agents** run `cd path/to/folder && eval "$(mise hook-env -s bash)";` at start of each shell series.
This will set all relevant env vars, including $PATH. The `mise x --` prefix is a shorthand of this.

Local lint and format use [hk](https://hk.jdx.dev/) (`hk.pkl` at root) wrapping
Biome. Git `pre-commit` and `commit-msg` live under `.githooks/` and call hk /
commitlint. `package.json` `prepare` sets `core.hooksPath` to `.githooks`.

```bash
hk fix                # apply biome fixes on staged/configured files
task check:changed    # hk check on git-changed files (no install)
task check:all        # hk check --all --profile ci (no install)
task check:full       # bun install, then hk --all --profile ci --profile full
```

CI is GitHub Actions. Do not treat `hk check` as a workflow replacement, but
prefer `task` names that match the gates.

### Bun workspace — Task at repo root

`bun` is the JavaScript runtime and package manager for this workspace.
There is no npm/`npx` fallback for package work. `Taskfile.yaml` is the
source of install / lint / format / build / test CLI invocations.
Biome and TypeScript run through workspace scripts (`bun run lint`,
`bun run build`); tests are `bun test` via `bun run test`. `commitlint`
and `openspec` are mise `npm:` tools; `node` is pinned only as their shim
runtime. `bun.lock` is the committed, CI-authoritative lockfile.

```bash
task install           # bun install at workspace root
task lint              # biome check packages/
task format:write      # biome check --write packages/
task build             # bun run build (api then mcp)
task test              # bun run test
task docs:dev          # TypeDoc + vitepress dev
task commitlint        # mise-pinned commitlint on origin/main..HEAD
```

## Verification

Run focused tests while developing, then the applicable gates:

```bash
task lint
task test
task build
openspec validate --all --strict --no-interactive
openspec doctor --json
```

Prefer the `task <name>` equivalents (see `Taskfile.yaml`) over raw `bun run`
invocations — they are the single source of truth for how each tool runs.

Some OpenSpec changes narrow or extend these commands. Treat the change's task
list as the verification checklist for that work.

## Continuous integration

GitHub Actions workflows live under `.github/workflows/`. Shared gates today:

- `ci-branch.yaml` — every branch push (not `main`) and PR to `main`: `task check:full`
  (install, lint, build, test, commitlint, docs build), `task lint:workflows`,
  both `.vsix` packages, and a macOS arm64 pre-release `variant` executable
  (`task package:vsix`, `task package:cli`). Also called by the release workflow.
- `ci-release.yaml` — push to `main`: runs `ci-branch.yaml`, then builds both `.vsix`
  files and `variant` single-file executables (`bun build --compile`) for
  linux/darwin/windows × x64/arm64, plus `SHA256SUMS`, and creates GitHub Release
  `v<version>`. No release when that tag already exists. Manual dispatch with
  `dry-run` (default) builds the assets without releasing.
- `publish-extensions.yaml` — manual dispatch only: publishes the `.vsix` files of a
  chosen release tag to the Visual Studio Marketplace and/or Open VSX.
- `docs.yml` — TypeDoc + VitePress to GitHub Pages (main)

When adding a gate, expose it as a `task` and call that task from the workflow.

### Releasing

The root package, `variant-api`, `variant-vscode` and `chat-renamer-vscode` share one
version (`task release:version` fails when they differ). Run `task version:incr:patch`
to bump every package and `bun.lock`, merge to `main`; a green build tags and releases
that version. To publish to the registries, dispatch `publish-extensions.yaml` with the tag; a reviewer approves the `marketplace`
environment first. One-time repo setup: environment `marketplace` with required
reviewers and secrets `VSCE_PAT` (Visual Studio Marketplace) and `OVSX_PAT` (Open VSX).

## Review and delivery

- Use Conventional Commits (`type(scope): summary`) and keep commits focused.
- OpenSpec history is artifact commits plus code in between: one spec-change commit at the start (`openspec/changes/$slug/` only), code/test commits while implementing, a `tasks.md` checkbox commit at wrapup if those edits are still dirty, then a separate **sync-archive** commit (sync deltas into `openspec/specs/`, then move the change under `openspec/changes/archive/`). Do not mix specs or `tasks.md` with product code. Do not mix the tasks commit with the sync-archive commit.
- Sync-archive on the same feature branch as the product pull request. Do not open a second branch or a second pull request for the archive.
- Work on a short-lived feature branch based on `main` unless the repository
  owner explicitly directs a different documentation-only flow.
- Keep the branch current and open a GitHub pull request for human review (`gh`).
- Agents may prepare and push a branch when asked. They must not delete it.
  They must not merge it unless the user **explicitly** requested a merge and
  the GitHub Actions result is success. The human reviewer owns the merge by default.
- Sync-archive an OpenSpec change only after its tasks and strict validation pass.

Never commit credentials or temporary environment state. Do not publish values
from local handover notes; extract only stable, non-sensitive facts into durable
documentation.
