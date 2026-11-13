# Contributing

## Before changing behavior

1. Read [`AGENTS.md`](AGENTS.md) and the relevant current capability under
   `openspec/specs/`.
2. Create or select an OpenSpec change under `openspec/changes/`.
3. Keep a change focused. Record product behavior in specs; keep VitePress
   `docs/` as user-facing library/MCP documentation, not a behavior spec.

## Citing a specification

Source comments, documentation, and specs cite the (future) **published** location under
`openspec/specs/<capability-path>/spec.md`, never the `openspec/changes/` a delta
was drafted under.

In markdown use a relative link, labelled by capability. Count the `../` segments from the citing file's own directory.

```markdown
[specs/<category>/<capability>](../../openspec/specs/<category>/<capability>/spec.md)
[specs/<category>/<capability> | Heading Link](../../openspec/specs/<category>/<capability>/spec.md#heading-link)
```

In code, a plain path in a comment is enough:

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

## Development patterns

- MUST co-locate test code with source as sibling `{file}.spec.ts`.
- MUST use present-tense test names that describe behavior.
- Prefer public API round-trips (`createVariantClient().free`, MCP tool handlers) over private internals.
- Zod schemas are the source of truth for response types.
- All chat-renamer functionality is also in `variant-vscode`, preferably through shared code. Some duplication between the `*.vscode` packages is 
allowed.
- The extension's tests run against `packages/variant-vscode/src/test/mock-vscode.ts`: add the part of the VS Code API a test needs to that mock.
- A new transport MUST pass the shared describeTransportContract` suite of `variant-ui/testing`. 
- Documentation-only baseline changes do not require new product tests, but they must run the existing checks cited as evidence by the selected OpenSpec change.

## Documenting new commands and functionality

Any extra commands or functionality that you add must also be added to the
[`README.md`](README.md) and to the documentation under `docs/`, in the same
pull request.
- a new CLI command appears in the README CLI section, as a section in
`docs/guide/core.md`, and, when it is a lifecycle command, as a tool in
`docs/mcp.md`
- a new flag, output format, or configuration key appears wherever
its command or section is described. Record the change in `CHANGELOG.md`.
- Binary-like flags are added as `yes|no` (not `true|false`) to facilitate future additional values.

## Tool execution

**All commands** and project tools (`openspec`, `task`, `bun`, `hk`, `commitlint`, etc)
should use mise-managed versions.
**AI agents** run `cd path/to/folder && eval "$(mise hook-env -s bash; set -x)";` at start of each shell series.
This will set all relevant env vars, including $PATH. Then `-x` echos, so no need for `echo '---what---'`. The `mise x --` prefix is a shorthand for this.

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

- `bun` is the JavaScript runtime and package manager for this workspace. There is no npm/npx fallback for package work. 
- `bun.lock` is the committed, CI-authoritative lockfile.
- `Taskfile.yaml` is the source of install / lint / format / build / test CLI invocations.
- Biome and TypeScript run through workspace scripts (`bun run lint`, `bun run build`). 
- Tests are `bun test` via `bun run test`.
- `commitlint` and `openspec` are mise `npm:` tools.
- `node` is pinned only as their shim runtime. 

```bash
task install           # bun install at workspace root
task lint              # biome check packages/
task format:write      # biome check --write packages/
task build             # bun run build (libraries, variant-ui, then the extensions)
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

A change that affects the `variant` command also runs `task bleed:cli`. That
publishes the host executable to `vw-bleeds/variant-cli/bin/`. The last step is
a minimal command in chat, with the command and its output, proving the bled
binary does the new thing.

## Continuous integration

GitHub Actions workflows live under `.github/workflows/`. Shared gates today:

- `ci-branch.yaml` — every push to a branch other than `main`: `task check:full`
  (install, lint, build, test, commitlint, docs build), `task lint:workflows`,
  and both `.vsix` packages (`task package:vsix`). Also called by the release workflow.
- `ci-release.yaml` — push to `main`: runs `ci-branch.yaml`, then builds both `.vsix`
  files and `variant` single-file executables (`bun build --compile`) for
  linux/darwin/windows × x64/arm64, plus `SHA256SUMS`, and creates GitHub Release
  `v<version>`. No release when that tag already exists. Manual dispatch with
  `dry-run` (default) builds the assets without releasing.
- `publish-extensions.yaml` — publishes the `.vsix` files of a release tag to the
  Visual Studio Marketplace and/or Open VSX. Triggered by `workflow_run` after
  `ci-release.yaml` completes, and only when that run created the release; also
  manually dispatchable.
- `docs.yml` — TypeDoc + VitePress to GitHub Pages (main)

When adding a gate, expose it as a `task` and call that task from the workflow.

### Releasing

The root package, `variant-api`, `variant-vscode` and `chat-renamer` share one
version (`task release:version` fails when they differ). Run `task release:prepare` on a
clean, current `main` (tracked files unchanged; `gh` authenticated). It chains four tasks, each
runnable alone to resume after a failure:

1. `task release:check`: refuses unless on `main`, tracked files unchanged, not behind `origin/main`, versions agree, `gh` authenticated.
2. `task version:incr:patch`: bumps every package and `bun.lock`.
3. `task release:changelog`: in every `CHANGELOG*.md` replaces the `Unreleased` heading with `## [<version>] - <date>` (the
   section's bullets stay under it; a changelog without `Unreleased` gets the section above its newest version) and adds the
   GitHub-generated pull request list as `### Release notes`. No `Unreleased` heading remains, so add `## Unreleased` again
   when you record the next change.
4. `task release:pr`: commits `chore(release): v<version>` on `release/v<version>`, pushes it and opens a pull request into
   `main` with the generated notes as its body. If the push fails, fix the remote and run `task release:pr` again.

It never tags or merges. A human reviews and merges the pull request; a green build then tags and releases
that version and runs `publish-extensions.yaml` for it. To publish an older tag
by hand, dispatch `publish-extensions.yaml` with the tag. One-time setup: environment
`marketplace` holding the secret `VSCE_PAT` (Visual Studio Marketplace; its trusted publishing is not supported
yet, see [vsmarketplace#1422](https://github.com/microsoft/vsmarketplace/issues/1422)).
Open VSX needs no token: register a trusted publisher per extension on open-vsx.org
(workflow `publish-extensions.yaml`, environment `marketplace`; it runs as its own
workflow both after a release and on manual dispatch). The first Open VSX
version of an extension must be published once with a token, since a trusted
publisher needs an existing extension. The workflow keeps the Marketplace Entra
variant as commented-out lines; it needs `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and
`AZURE_SUBSCRIPTION_ID` as variables on `marketplace`.

The release workflow calls `packslip.yaml` after it creates the release. The signing job has `contents: read`.
A failed sign is retried by dispatching `packslip.yaml` from `main` with the tag, then `publish-extensions.yaml`
if registry publication was skipped.

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
documentation. Committed specs, code, and docs do not name other local products,
customer repositories, or machine paths. Chat may.
