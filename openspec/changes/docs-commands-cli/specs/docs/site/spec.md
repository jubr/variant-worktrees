## MODIFIED Requirements

### Requirement: Commands groups lifecycle commands

The Commands page SHALL have the second-level sections *Basic commands* and *Lifecycle commands*, in this order, matching the `section` of each command (`basic`, `lifecycle`). *Basic commands* SHALL hold `init`, `config`, `list` and `status` as third-level headings. *Lifecycle commands* SHALL open with an introduction saying that these commands move a variant through the flow of steps, and SHALL hold `create`, `provision`, `up`, `watch`, `down`, `deprovision` and `implode` as third-level headings in the order of the flow of steps. The text of every command heading SHALL be the command line in inline code, ``variant <name>``, so its id is `variant-<name>` and `commands#variant-create` is the deep link of `create`. The page intro SHALL say what the two sections hold and SHALL point to the CLI page for the commands only the CLI offers (`ui`, `mcp`, `completions`), which the page SHALL NOT otherwise mention as headings.

#### Scenario: Commands are grouped

- **WHEN** the headings of the built Commands page are listed in page order
- **THEN** the second-level headings are Basic commands and Lifecycle commands
- **AND** the third-level headings below Basic commands are `variant init`, `variant config`, `variant list`, `variant status`
- **AND** the third-level headings below Lifecycle commands are `variant create`, `variant provision`, `variant up`, `variant watch`, `variant down`, `variant deprovision`, `variant implode`

#### Scenario: Headings follow the section tag

- **WHEN** the registered commands are grouped by their `section`
- **THEN** the third-level headings of each Commands section are `variant <name>` for the commands of that section

#### Scenario: Command headings have prefixed ids

- **WHEN** the built Commands page is read
- **THEN** the heading of `create` has the id `variant-create` and a code element with the text `variant create`

#### Scenario: The intro points to the CLI page

- **WHEN** the intro of the built Commands page is read
- **THEN** it links to `/guide/cli`

### Requirement: Overview steps are short and link to commands

Each builtin step of the Overview that is also a command (`create`, `provision`, `watch`, `down`, `deprovision`, `implode`) SHALL be a minimal explanation of what the step does, of at most 60 words, with no list, no table, no flag or option list and no configuration example. It SHALL end with the sentence ``More details at Commands [`variant <command>`](commands#variant-<command>).``, linking to the section of that command in Commands. That sentence SHALL be the last line of the explanation's paragraph, with no blank line before it, not a paragraph of its own. What the step no longer says SHALL be in that Commands section. A step that is not a command, `seed`, and the Custom Steps and Custom multi-tenancy steps sections SHALL keep their full explanation and full configuration example, and SHALL link to the headings of the keys they use, such as `variant.steps`, `db.multi` and `db.multi.schemaPrefix`. The Overview SHALL show `VARIANT_STEP_<STEP>=no` as typed.

#### Scenario: Command steps are short and end with a Core link

- **WHEN** the section of each of `create`, `provision`, `watch`, `down`, `deprovision` and `implode` in the built Overview page is read
- **THEN** it has at most 60 words before the sentence `More details at Commands` and contains no list, table or fenced code
- **AND** that sentence is in the last paragraph of the section, which also holds the explanation, and it ends with a link whose text is `variant <command>` and whose target is `/guide/commands#variant-<command>`, and a period

#### Scenario: The seed step keeps its explanation and example

- **WHEN** the section `seed` of the built Overview page is read
- **THEN** it contains fenced YAML that sets the `seed` step
- **AND** it links to the Configuration heading of `variant.steps`
- **AND** it has no `More details at` sentence

#### Scenario: Custom steps keep their examples

- **WHEN** the built Overview page is read
- **THEN** its Custom Steps and Custom multi-tenancy steps sections each contain fenced YAML
- **AND** the multi-tenancy section links to the Configuration headings of `db.multi`

#### Scenario: Core carries what the Overview drops

- **WHEN** the built Commands page is read
- **THEN** its `variant provision` and `variant deprovision` sections link to the Configuration headings of `variant.steps` and `db.multi`
- **AND** its `variant watch` section names `--reprovision`

### Requirement: MCP tools have a heading each

The *Available tools* section of the MCP server page SHALL have one third-level heading per registered tool, named as the tool (`variant_init`), in the order of the commands. Each tool section SHALL link to the section of the same command in Commands (`variant_init` to `/guide/commands#variant-init`), with the link text ``variant <command>``, SHALL state only what differs from that command, and SHALL show a table of the parameters the tool takes. Arguments a tool fixes itself SHALL NOT be in the table. The page SHALL NOT have a Testing section.

#### Scenario: One heading per registered tool

- **WHEN** the third-level headings of *Available tools* in the built MCP page are listed
- **THEN** they equal `variant_<name>` for every registered command, in registration order

#### Scenario: No Testing section

- **WHEN** the headings of the built MCP page are listed
- **THEN** none is named Testing

#### Scenario: Each tool links to Core and lists its parameters

- **WHEN** the section of a tool in the built MCP page is read
- **THEN** it links to the Commands heading of the command of that name, and the link text is `variant <name>`
- **AND** its table has one row per argument the tool takes
- **AND** the table has no row for an argument the tool fixes

### Requirement: Site layout

The pages of the site SHALL live in directories that match the sidebar: `index.md` is Getting Started and the landing page, `guide/` holds the Variant Worktrees pages (Overview, Commands, CLI, Configuration, Installation, Runtime, Workspace), `vscode/` holds Extension, MCP server and Socket IPC, `chat-renamer/` holds the Chat Renamer pages, and `development/` holds Building and the library. The Commands page is `guide/commands`. What belongs to the command line itself (the global flags, which include the slug, and the shell completions) SHALL be on `guide/cli`. The library page SHALL hold the command definitions. Where another requirement names a page by an earlier URL or as Core, the page of this layout applies.

#### Scenario: Pages are where the sidebar says

- **WHEN** the built site is listed
- **THEN** it has `index.html`, `guide/commands.html`, `guide/cli.html`, `vscode/extension.html`, `vscode/mcp.html`, `vscode/socket-ipc.html` and `development/library.html`
- **AND** it has no `guide/index.html`, `guide/core.html` or `cli-vscode-webview.html`
- **AND** the built library page has the heading Command definitions

## ADDED Requirements

### Requirement: CLI page lists the commands and holds the CLI-only ones

The CLI page SHALL have the second-level sections *Basic commands*, *Lifecycle commands*, *CLI-only commands* and *Global flags*, in this order, and *Global flags* SHALL be the last second-level section. It SHALL NOT have a section of its own for the slug. *Basic commands* and *Lifecycle commands* SHALL each be only a list of one link per command of that `section` (`init`, `config`, `list`, `status`; then `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode`), each an inline-code link ``[`variant <name>`](./commands#variant-<name>)`` into the Commands page. They SHALL hold no intro text, no description and nothing but those links. *CLI-only commands* SHALL have the third-level headings ``variant mcp``, ``variant ui`` and ``variant completions``, one for each command of section `cli`, each holding the full documentation of that command, with the ids `variant-mcp`, `variant-ui` and `variant-completions`. The Commands page SHALL NOT document those three, and the CLI page SHALL NOT have the sections *MCP server* or *Completions*. *Global flags* SHALL say that the flags work on every command, before or after its name, and SHALL have a table with a row for each of `-C <path>`, `-s <slug>` / `--slug <slug>`, `--json`, `--yaml`, `--log-level`, `-v`, `--help` and `--version`. The `-s` row SHALL say that a command which takes no slug ignores it and that a missing slug is the one of the current worktree branch. The `-v` row SHALL give `-v`, `-vv` and `-vvv` as `info`, `debug` and `trace`. The `--log-level` row SHALL NOT mention `warning`. The page and the other documentation SHALL NOT show a slug as a positional argument.

#### Scenario: Heading structure

- **WHEN** the second-level headings of the built CLI page are listed
- **THEN** Basic commands precedes Lifecycle commands, which precedes CLI-only commands, which precedes Global flags, and Global flags is the last
- **AND** the third-level headings below CLI-only commands are `variant mcp`, `variant ui`, `variant completions`
- **AND** no heading is named Slug

#### Scenario: Global flags table

- **WHEN** the table below Global flags of the built CLI page is read
- **THEN** it has rows for `-C`, `-s`, `--json`, `--yaml`, `--log-level`, `-v`, `--help` and `--version`
- **AND** the `-v` row names `-vv` and `-vvv`
- **AND** the `--log-level` row does not contain `warning`

#### Scenario: No positional slug in the documentation

- **WHEN** the Markdown under `docs/` and the README are searched for a command line of `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode` or `status` that gives a slug without `-s`
- **THEN** none is found

#### Scenario: Basic and lifecycle lists are deep links into Commands

- **WHEN** the content below Basic commands and Lifecycle commands of the built CLI page is read
- **THEN** the first is a list of exactly the links `/guide/commands#variant-init`, `variant-config`, `variant-list`, `variant-status`
- **AND** the second is a list of exactly the links `/guide/commands#variant-create`, `variant-provision`, `variant-up`, `variant-watch`, `variant-down`, `variant-deprovision`, `variant-implode`
- **AND** every link text is the inline code `variant <name>` of its target
- **AND** neither has text other than the links

#### Scenario: Lists follow the registry

- **WHEN** a command is added to the registry with a `section` and not to the matching list or heading
- **THEN** the documentation test fails and names the command

#### Scenario: CLI-only content moved

- **WHEN** the built Commands and CLI pages are read
- **THEN** the CLI page has no heading MCP server or Completions
- **AND** the Commands page has no heading `variant ui`, `variant mcp` or `variant completions`

### Requirement: Command links carry the command line

Every link in the documentation to the heading of a command (`/guide/commands#variant-<name>` or `/guide/cli#variant-<name>`) SHALL have as its text the inline code of that heading, ``variant <name>``, and not the bare name. This includes links inside the Commands and the CLI page. No link SHALL use a bare command anchor such as `commands#create`.

#### Scenario: Link text matches the heading

- **WHEN** the built pages are read
- **THEN** each link whose target is a heading of the Commands page or of the CLI-only commands has a single code element as its content, and its text equals the text of the target heading

#### Scenario: No bare command anchors

- **WHEN** tracked Markdown under `docs/` and the README are searched
- **THEN** none links to `commands#create`, `commands#init` or another `commands#<bare name>`, nor to `cli#mcp-server` or `cli#completions`

### Requirement: Configuration options are separated by a rule

On the Configuration page, every option heading (the third-level headings of *Variant options* and *Database options*) except the first below its section heading SHALL be preceded by a horizontal rule that carries the class `option-sep`. The stylesheet SHALL give that rule and the option heading that follows it less vertical space than a regular rule and a regular third-level heading have.

#### Scenario: A rule precedes each option

- **WHEN** the built Configuration page is read
- **THEN** each third-level heading of Variant options and Database options other than the first of each section is directly preceded by an `hr` element with the class `option-sep`

#### Scenario: The rule is tighter than the default

- **WHEN** the built stylesheet is read
- **THEN** a rule for `hr.option-sep` sets a vertical margin smaller than the VitePress default of 24px, and a rule for the heading after it sets a top margin smaller than 32px

