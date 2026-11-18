## Why

Two defects make a variant start with the wrong tools or the wrong files:

- `SQLITE_DATABASE: '${worktree}/.cache/variant/${schema}.sqlite'` is meant to name a file inside the variant's worktree. `${worktree}` is the path the run happens to carry: when `cwd`, `variant.main` or `variant.root` reach the run through a relative or unnormalized value, it expands to a relative path. A watch started from another working directory then opens a different file than the one provisioning created.
- Mise can put directories ahead of its own tool directories on `PATH` (a user-level Bun install, a package-manager shim). A watch or step that runs `bun` then gets a Bun other than the one `mise.toml` pins, and `bun install --frozen-lockfile` or `bun.lock` behave differently with no hint why.

## What Changes

- `${worktree}` always expands to an absolute path, normalized (`..` and `.` removed), in every setting and command that accepts the placeholder, no matter how the working directory, `variant.main` or `variant.root` was given.
- Before a watch, step or provision runs host commands, the system checks the Bun that those commands will find on their `PATH` against the Bun version that Mise resolves for the project directory. When Mise pins a Bun version and the `PATH` one is a different version, it logs one warning that names both versions and paths and which directory comes first on `PATH`. The check never changes `PATH` and never fails the command.
- The warning carries a hint on how to solve it: how the foreign Bun was probably installed and how to remove it, and the lines of the shell startup files (`~/.zshrc`, `~/.bashrc`, `~/.profile` and the like) that put its directory on `PATH`.
- `variant init`, the onboarding command of the CLI, the MCP server and the editor, runs the same check and reports it in its result as `bun`, with the same hint. It never fails the command and changes nothing.
- No warning when the project pins no Bun, when Mise is not available, or when the versions are equal.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/provisioning`: `${worktree}` is an absolute, normalized path.
- `tools/mise`: a check that the Bun on a command's `PATH` is the Bun that Mise pins, reported as a warning with a hint on how to fix it.
- `variant-api/init`: `init` reports that check as `bun`.

## Impact

- `variant-api`: `prepareRun` (`run-context.ts`) and the callers that give it a worktree; a new Bun-toolchain check beside `mise.ts`, called where provision and watch start host commands, with its warning going through the existing `log` option, and by `initProject`, whose `InitResult` gains `bun`; `variant-cli` text output of `init` and the onboarding confirmation of `variant-vscode` show it.
- `variant-config` template rendering is unchanged; `variant-api` is the one place that decides the worktree.
- Docs: `docs/guide/configuration.md` (placeholder table), `docs/guide/runtime.md` (the warning and the hint), `docs/guide/core.md` (`init` result), `CHANGELOG.md` (Fixed and Added bullets under `## Unreleased`).
- No new setting and no new dependency.

Non-goals: rewriting `PATH` to put Mise first, a setting to turn the warning off, checking tools other than Bun, and failing a command because of a mismatch.
