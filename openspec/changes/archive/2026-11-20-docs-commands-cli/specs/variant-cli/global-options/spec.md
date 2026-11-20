## ADDED Requirements

### Requirement: The slug is a global option

The CLI SHALL accept the slug as the global option `-s <slug>`, `--slug <slug>` or `--slug=<slug>`, before and after the command name, so `variant create -s preview-one` and `variant -s preview-one create` are the same command. A command that takes no slug (`init`, `config`, `list`, `ui`, `mcp`, `completions`) SHALL ignore it without an error or a warning. Without it, a command that takes a slug SHALL take the slug of the current worktree branch. A slug given without a value SHALL fail before the command runs. No command SHALL take the slug as a positional argument: a command line with an argument that no command defined, such as `variant implode preview-one`, SHALL fail before the command runs with an error that names the argument and says to use `-s`. A library command definition SHALL keep its `slug` argument, so the MCP server and the webview forms are unchanged.

#### Scenario: Slug after the command

- **WHEN** a user runs `variant create -s preview-one`
- **THEN** `execute()` receives `{ slug: "preview-one" }`

#### Scenario: Slug before the command

- **WHEN** a user runs `variant -s preview-one create`
- **THEN** `execute()` receives `{ slug: "preview-one" }`

#### Scenario: Long forms

- **WHEN** a user runs `variant --slug preview-one create` or `variant create --slug=preview-one`
- **THEN** `execute()` receives `{ slug: "preview-one" }`

#### Scenario: Ignored where it makes no sense

- **WHEN** a user runs `variant list -s preview-one` or `variant -s preview-one config`
- **THEN** the command runs as without the option and prints no error and no warning

#### Scenario: No positional slug

- **WHEN** a user runs `variant implode preview-one`
- **THEN** the process exits non-zero, standard error names `preview-one` and `-s`, and nothing is imploded

#### Scenario: Slug without a value

- **WHEN** a user runs `variant create -s`
- **THEN** the process exits non-zero and the command does not run
