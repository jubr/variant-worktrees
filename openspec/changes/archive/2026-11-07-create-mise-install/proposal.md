## Why

A new worktree does not have its Mise tools installed. Agents run `mise install` as a separate step after `variant create`, and a human who forgets it starts working with missing tools. Create should install those tools, in the background by default, wherever Mise is part of the project, and the agent workflow should stop doing it by hand.

## What Changes

- `create`, `provision`, and `watch` accept `miseInstall` with values `bg`, `sync`, and `no`. The CLI flag is `--mise-install`. No short flag. `up` does not accept it.
- **BREAKING**: omitted `miseInstall` means `bg` on the library methods, the CLI, and the MCP tools for `create`, `provision`, and `watch`.
- `bg` and `sync` install only when that worktree has a Mise config. No config means no install and no error, so a project that does not use Mise is unchanged. `no` never installs.
- There is no configuration-file key. The mode is the flag, and the install runs only inside `create`. `provision` and `watch` pass the flag through.
- The install directory is the variant worktree, including one that already existed. Slug `main` and a create that makes no worktree install nothing.
- The sequence is `mise -C <worktree> trust --all`, then `mise install` in that worktree, using the resolved Mise executable. It does not wait for interactive input.
- `bg` leaves that run's output in `{worktree}/.cache/variant/mise-install.log` and returns while the run continues. When a config is present and the executable is missing, or the process cannot be started, the command fails and the worktree stays. A later non-zero exit does not fail `bg`.
- `sync` waits. A non-zero exit fails the command and the error carries Mise's output. The worktree stays.
- An invalid value fails before any worktree is created.
- `vw-spec-start` drops its separate Mise install step. Its create line passes `--mise-install=bg` and names `sync` and `no` as the other values.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `variant-api/core`: `create` trusts the worktree and installs its Mise tools when `miseInstall` is `bg` or `sync` and the worktree has a Mise config. Omitted means `bg`. `no`, a worktree with no Mise config, and `up` do not install. `provision` and `watch` pass the same option through to `create`.
- `variant-api/commands`: `create`, `provision`, and `watch` accept optional `miseInstall`. Omitted, each runs as `bg`. The CLI, MCP tools, and generated forms derive it from that definition. No other command accepts it.
- `variant-mcp/tools`: `variant_create`, `variant_provision`, and `variant_watch` accept optional `miseInstall` (`bg`, `sync`, `no`). Omitted means `bg`.

## Impact

- `variant-api`: `create` owns the install. `provision` and `watch` gain `miseInstall` beside `from` and pass it into `create`. The resolved Mise executable is used only after a Mise config is found in the worktree.
- `variant-cli` and `variant-mcp`: the flag and tool input come from the shared command definition. `variant-ui` forms follow that definition. Shell completions follow it too.
- Docs: `README.md` CLI section, `docs/guide/core.md`, `docs/guide/library.md`, `docs/mcp.md`, and `CHANGELOG.md`.
- Agent workflow: `.agents/skills/vw-spec-start/SKILL.md` removes the tooling step. `AGENTS.md` names `--mise-install` on the create bullet.
- Non-goals: a `variants.yaml` key for the mode; installing on `up`, `down`, `deprovision`, `implode`, `status`, `list`, `init`, or `config`; installing when the slug is `main`, no worktree is created, or the worktree has no Mise config; deleting a worktree because Mise failed; changing which tools `mise install` selects.
