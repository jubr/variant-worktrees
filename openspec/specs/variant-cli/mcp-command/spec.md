# variant-cli/mcp-command Specification

## Purpose

`variant mcp` starts the standalone MCP server from the `variant` command, so one executable, one install and one update cover the command line and the MCP server for AI clients.

## Requirements

### Requirement: variant mcp starts the MCP server

`variant mcp` SHALL start the stdio MCP server in the working directory, serving the same tools, results and logging notifications as the standalone server did as `variant-mcp`: one tool per lifecycle command named `variant_<command>`, and no `variant_destroy`. It SHALL accept the option `--config <path>`, which names the `variants.yaml` to load; without it the configuration of the working directory is loaded. `-C <path>` SHALL change the working directory first, as it does for every command. Standard output SHALL carry only the MCP protocol: the command SHALL print no banner, warning, log line or result to it. The command SHALL run until the client closes the connection. An unknown option SHALL fail before the server starts, with an error on standard error and a non-zero exit status. `--json`, `--yaml` and `--log-level` SHALL be accepted and SHALL NOT change what the server does; the server's logs go to the client as MCP logging notifications and to the editor, and the client sets their level.

`mcp` SHALL be listed with the other commands in `variant --help`, SHALL have its own `variant mcp --help` that lists `--config`, and SHALL be completed by the shell completion scripts. It SHALL NOT be an MCP tool and SHALL NOT be a lifecycle command.

#### Scenario: Tools list over stdio

- **WHEN** an MCP client starts `variant mcp` in a directory with `variants.yaml` and lists the tools
- **THEN** the list includes `variant_list` and `variant_create`, and has no `variant_destroy`

#### Scenario: Config option

- **WHEN** `variant mcp --config /workspace/variants.yaml` starts from another directory and the client calls `variant_config`
- **THEN** the result is the configuration of `/workspace/variants.yaml`

#### Scenario: Working directory option

- **WHEN** `variant -C /workspace mcp` starts and the client calls `variant_list`
- **THEN** the server loaded the configuration of `/workspace`

#### Scenario: Standard output is protocol only

- **WHEN** `variant mcp` runs and the client sends `initialize`
- **THEN** every line on standard output is a JSON-RPC message
- **AND** a configuration warning, if any, is not written to standard output

#### Scenario: Unknown option

- **WHEN** `variant mcp --nope` runs
- **THEN** it exits non-zero with an error on standard error and starts no server

#### Scenario: Output flags do not change the server

- **WHEN** `variant mcp --json` starts
- **THEN** the server starts as without the flag and the tool results are the JSON text they always are

#### Scenario: Listed in help and completions

- **WHEN** `variant --help` and `variant completions zsh` run
- **THEN** both name `mcp`
- **AND** `variant mcp --help` lists `--config`

### Requirement: The MCP server needs no second executable

The `variant mcp` command SHALL run from the `variant` command alone: from the `variant-cli` npm package and from every compiled single-file executable of a release, with no other package, executable or file installed next to it. The `variant-mcp` package SHALL NOT declare a `bin`, and `variant-api`, `variant-cli`, the server package and `variant-mcp` SHALL together declare only `variant` as an executable. No task, release asset or documentation SHALL name an executable `variant-mcp`. The documented MCP client configuration SHALL be `"command": "variant"` with `"args": ["mcp"]`, and with `["mcp", "--config", "<path>"]` for a named configuration.

#### Scenario: Installed package

- **WHEN** only `variant-cli` is installed from the registry and an MCP client starts `variant mcp`
- **THEN** the server starts and answers a tools list

#### Scenario: Compiled executable

- **WHEN** a compiled `variant` executable runs `variant mcp` away from the repository and a client lists the tools
- **THEN** the server answers the list, and `variant_list` is in it

#### Scenario: No second bin

- **WHEN** the manifests of `variant-api`, `variant-cli`, the server package and `variant-mcp` are read
- **THEN** `variant` is the only `bin` among them

#### Scenario: Client configuration documented

- **WHEN** the repository README and the MCP server page are read
- **THEN** their client configuration runs `variant` with the argument `mcp`
- **AND** neither contains a command named `variant-mcp`
