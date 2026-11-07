## Why

A new worktree does not have its Mise tools installed. Agents run `mise install` as a separate step after `variant create`, and a human who forgets it starts working with missing tools. Create should install those tools, in the background by default, and the agent workflow should stop doing it by hand.

## What Changes

- `create` accepts `miseInstall` with values `bg`, `sync`, and `no`. The CLI flag is `--mise-install`. No short flag.
- **BREAKING** for the CLI and MCP: omitted `miseInstall` means `bg`. `variant create` and `variant_create` start Mise in the background and return. `sync` waits and fails the command when Mise fails. `no` installs nothing.
- The library method `create` does not install when `miseInstall` is omitted. Only `bg` and `sync` install. The command layer is what supplies `bg` for an omitted flag.
- The install directory is the variant worktree, including one that already existed. Slug `main` and a create that makes no worktree install nothing.
- The sequence is `mise -C <worktree> trust --all`, then `mise install` in that worktree, using the resolved Mise executable. It does not wait for interactive input.
- `bg` leaves that run's output in `{worktree}/.cache/variant/mise-install.log` and returns while the run continues. A missing executable, or a process that cannot be started, fails the command. A later non-zero exit does not.
- `sync` waits. A non-zero exit fails the command and the error carries Mise's output. The worktree stays.
- An invalid value fails before any worktree is created.
- `provision`, `up`, and `watch` do not take the option and do not install, even when they create a worktree.
- `vw-spec-start` drops its separate Mise install step. Its create line passes `--mise-install=bg` and names `sync` and `no` as the other values.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `variant-api/core`: after `create` has a worktree, `miseInstall` of `bg` or `sync` trusts that worktree and installs its Mise tools. Omitted and `no` do not. Other operations do not.
- `variant-api/commands`: `create` accepts optional `miseInstall`. Omitted, the command runs as `bg`. The CLI, MCP tools, and generated forms derive it from that definition. No other command accepts it.
- `variant-mcp/tools`: `variant_create` accepts optional `miseInstall` (`bg`, `sync`, `no`). Omitted means `bg`.

## Impact

- `variant-api`: `create` gains `miseInstall` beside `from`. Install runs only on that method, after the worktree exists, with the resolved Mise executable.
- `variant-cli` and `variant-mcp`: the flag and tool input come from the shared command definition. `variant-ui` forms follow that definition. Shell completions follow it too.
- Docs: `README.md` CLI section, `docs/guide/core.md`, `docs/guide/library.md`, `docs/mcp.md`, and `CHANGELOG.md`.
- Agent workflow: `.agents/skills/vw-spec-start/SKILL.md` removes the tooling step. `AGENTS.md` names `--mise-install` on the create bullet.
- Non-goals: installing on `provision`, `up`, `watch`, `down`, `deprovision`, `implode`, `status`, `list`, `init`, or `config`; installing when the slug is `main` or no worktree is created; deleting a worktree because Mise failed; changing which tools `mise install` selects.
