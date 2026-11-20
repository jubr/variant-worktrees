# MCP Server

`variant mcp` starts an MCP server that exposes database variant lifecycle operations to MCP clients.
It is part of the `variant` command: no second executable is installed.

## Setup

The [Variant Worktrees extension](./extension) registers the `variant` server for the open workspace in Cursor and VS Code.
[Installation](/guide/installation) covers installing the CLI and the extension.
The `mcp.json` snippet stays the setup for other clients.

Run the server with a workspace configuration:

```bash
variant mcp --config /workspace/variants.yaml
```

MCP client configuration:

```json
{
  "mcpServers": {
    "variant": {
      "command": "variant",
      "args": ["mcp", "--config", "/workspace/variants.yaml"]
    }
  }
}
```

## Available tools

Every tool is the command of the same name in [Commands](/guide/commands), run in-process.
Each tool below says only what differs from that command, and lists the parameters it takes.
`slug` is optional for the operations that support git worktree detection, and an explicit slug always takes precedence.
Every result is returned as JSON text.

### `variant_init`

[`variant init`](/guide/commands#init) in the working directory of the server.
It returns what each step did, and `bun`, the check that the Bun on `PATH` is the one Mise pins with a hint when it is not.
It acts in-process, not through the editor.
Each of `file`, `gitignore` and `mise` is on unless `false`.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `prefix` | string | no | Worktree directory prefix, default `_v-` |
| `file` | boolean | no | Write `variants.yaml` |
| `gitignore` | boolean | no | Add the worktree pattern to `.gitignore` |
| `mise` | boolean | no | Add the variant CLI to the Mise configuration |
| `force` | boolean | no | Replace the `variants.yaml` of this directory when it exists |

### `variant_config`

[`variant config`](/guide/commands#config): the resolved configuration.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_create`

[`variant create`](/guide/commands#create).
`miseInstall` is `bg`, `sync` or `no`; omitted it is `bg`, and `bg` writes `{worktree}/.cache/variant/mise-install.log`.
A failure includes the command to run again.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `from` | string | no | Commit, tag, or branch a new variant branch starts at. Omitted, it starts at [`variant.baseBranch`](/guide/configuration#variant-basebranch) |
| `pullFf` | boolean | no | Fast-forward the start branch before a new variant branch is created |
| `miseInstall` | string | no | `bg`, `sync` or `no` |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_list`

[`variant list`](/guide/commands#list): the state and the database variants with their mode, uptime and watch log file.
With `verbose` every item carries all meta information, the same as `variant_status`.
With [`db.multi`](/guide/configuration#db-multi) set, items carry `schemas`.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `verbose` | boolean | no | All meta information of every variant |

### `variant_status`

[`variant status`](/guide/commands#status): the facts of `variant_list` plus a `runtime` object with the runtime state: mode, directory, database settings with the password hidden, and per watch the port, pid, URL, liveness and uptime.
An unknown slug is an error.
With [`db.multi`](/guide/configuration#db-multi) set it carries `schemas`.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_provision`

[`variant provision`](/guide/commands#provision): install, env file, `up`, step and seed commands.
`miseInstall` is passed through to the create; omitted it is `sync`.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `from` | string | no | Commit, tag, or branch a new variant branch starts at |
| `pullFf` | boolean | no | Fast-forward the start branch before a new variant branch is created |
| `miseInstall` | string | no | `bg`, `sync` or `no` |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_up`

[`variant up`](/guide/commands#up), after provision and seed.
It returns the mode, worktree, database target, and the port, URL and container name of each watch.
`up` does not take `miseInstall`.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `from` | string | no | Commit, tag, or branch a new variant branch starts at |
| `pullFf` | boolean | no | Fast-forward the start branch before a new variant branch is created |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_down`

[`variant down`](/guide/commands#down): stops the processes and containers of a variant and keeps its data.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_deprovision`

[`variant deprovision`](/guide/commands#deprovision): stops the watches and drops the schemas.
A `deprovision` step replaces the drop. It refuses `main` and leaves the worktree.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_watch`

[`variant watch`](/guide/commands#watch), always detached: a tool call cannot stay attached to a console, so `detach` is fixed and is not a parameter.
It returns the pids, ports and URLs.
Each output line is prefixed `[name]` and appended to `.cache/variant/watch.log` in the worktree (see `log` of `variant_status`).
A detached watch writes no ready-probe line.
[`output.mode`](/guide/configuration#variant-watches-key-output-mode) `tty` gives a watch a terminal, so color is in that log, and an omitted mode stays `no-tty` here, because this server does not see editor extensions.
`miseInstall` is passed through to the create; omitted it is `sync`.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `from` | string | no | Commit, tag, or branch a new variant branch starts at |
| `pullFf` | boolean | no | Fast-forward the start branch before a new variant branch is created |
| `miseInstall` | string | no | `bg`, `sync` or `no` |
| `reprovision` | boolean | no | Drop the schemas before provisioning again |
| `verbose` | boolean | no | Full output of quiet steps |

### `variant_implode`

[`variant implode`](/guide/commands#implode).
`branchRm` is `yes` or `no`; omitted it is `yes`, and `no` keeps the local branch.
It refuses `main` and work that is not merged into [`variant.baseBranch`](/guide/configuration#variant-basebranch), including a branch started with `from`; the error names `force`, which overrides the gate.
There is no `variant_destroy`; `variant_implode` replaces it.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | no | Variant slug; defaults to the current git worktree |
| `force` | boolean | no | Implode work that is not merged and a worktree with local changes |
| `branchRm` | `yes` or `no` | no | Remove the local branch after the worktree. Default `yes` |
| `verbose` | boolean | no | Full output of quiet steps |
