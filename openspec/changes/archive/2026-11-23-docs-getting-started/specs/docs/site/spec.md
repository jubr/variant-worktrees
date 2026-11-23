## MODIFIED Requirements

### Requirement: Sidebar groups

The sidebar SHALL list Getting Started, then a Variant Worktrees group, then a VSCode / Cursor group, then Chat Renamer, then Development. Getting Started SHALL be a link to the site root above the Variant Worktrees group and SHALL NOT be an item inside that group. Variant Worktrees SHALL list Overview, then Installation, then Commands, then CLI, then Configuration, then Runtime, then Workspace. VSCode / Cursor SHALL list Extension, then the MCP server, then the Socket IPC page, and those three SHALL NOT be items of the Variant Worktrees group. Chat Renamer SHALL include the page named Extension and, under it, a configuration page, and SHALL sit above Development. Development SHALL list Building, then the library. The library SHALL NOT be an item of the Variant Worktrees group. The sidebar SHALL NOT link to a guide about replacing shell scripts.

#### Scenario: Installation page lists the groups in order

- **WHEN** the built installation page is read
- **THEN** the sidebar shows Getting Started, then Variant Worktrees, then VSCode / Cursor, then Chat Renamer, then Development
- **AND** Overview precedes Installation, which precedes Commands, which precedes CLI, which precedes Configuration, which precedes Runtime, which precedes Workspace
- **AND** Workspace precedes the VSCode / Cursor group, which lists Extension, then the MCP server, then the Socket IPC page
- **AND** Chat Renamer lists its configuration page under the Extension page
- **AND** Development lists Building, then the library
- **AND** the page does not link to `/guide/scripts`

### Requirement: Configuration page structure

The Configuration page SHALL have the second-level sections *Variant options*, *Chat Renamer options*, *Database options*, *Custom Steps*, *Custom multi-tenancy steps*, *Templates* and *Unknown keys and migration*, in this order. *Variant options* SHALL give every key of `variant` in `variants.yaml` its own heading named `variant.<key>`, in alphabetical order, so other pages can link to it. Every sub-key of those options SHALL have a third-level heading of its own named with its full path (`variant.implode.maxDiffLines`, `variant.mise.binPath`, `variant.watches.<key>.dir`, `variant.steps.<name>.cmd`), directly after its parent and in alphabetical order. *Chat Renamer options* SHALL link to the Chat Renamer configuration page and has no heading per key. *Database options* SHALL have a third-level heading for every key of `db` and every key of `db.multi` (`db.ssl`, `db.multi.tenantsCmd`). The `variant.steps` section SHALL link to `overview#flow-of-steps`. *Templates* SHALL list every placeholder and environment form in a table with the columns Item, Meaning, Example use and Example value, and no column for the pass. *Unknown keys and migration* SHALL be the last section and SHALL NOT name a key or shape of an earlier version.

#### Scenario: Every option has an anchor

- **WHEN** the built Configuration page is read
- **THEN** each key of `variant` in the `variants.yaml` schema has a heading `variant.<key>`, for example `variant.abbr` and `variant.baseBranch`

#### Scenario: Options are alphabetical

- **WHEN** the `variant.<key>` headings of the Variant options section are listed in page order
- **THEN** they equal the same list sorted alphabetically

#### Scenario: Every sub-key has a heading

- **WHEN** the third-level headings of the built Configuration page are read
- **THEN** every sub-key path of `variant` in the `variants.yaml` schema has one, where a key below `watches` is written `variant.watches.<key>.<option>` and a key below `steps` is `variant.steps.<name>.<option>`
- **AND** the headings for every key of `db`, for `db.multi.schemaPrefix`, `db.multi.tenants` and `db.multi.tenantsCmd` exist
- **AND** all headings starting with `variant.` are in alphabetical order by full path, and so are those starting with `db.`

#### Scenario: Section order

- **WHEN** the second-level headings of the Configuration page are listed
- **THEN** they are Variant options, Chat Renamer options, Database options, Custom Steps, Custom multi-tenancy steps, Templates and Unknown keys and migration

#### Scenario: Chat Renamer options link to their page

- **WHEN** the Chat Renamer options section of the built Configuration page is read
- **THEN** it links to `/chat-renamer/configuration`
- **AND** it has no third-level heading

#### Scenario: Steps link to the flow of steps

- **WHEN** the `variant.steps` section of the built Configuration page is read
- **THEN** it links to `/guide/overview#flow-of-steps`

#### Scenario: Templates are listed in a table

- **WHEN** the Templates section of the built Configuration page is read
- **THEN** its table has the columns Item, Meaning, Example use and Example value, and no column Pass
- **AND** it has a row for each of `${slug}`, `${schema}`, `${storage}`, `${worktree}`, `${url}`, `${port}`, `${<watch>.port}`, `${abbr}`, `${multi.tenants}`, `${multi.schemaPrefix}`, `${NAME}`, `${NAME:-default}` and `$${`

### Requirement: Overview steps are short and link to commands

Each builtin step of the Overview that is also a command (`create`, `provision`, `watch`, `down`, `deprovision`, `implode`) SHALL be a minimal explanation of what the step does, of at most 60 words, with no list, no table, no flag or option list and no configuration example. It SHALL end with the sentence ``More details at Commands [`variant <command>`](commands#variant-<command>).``, linking to the section of that command in Commands. That sentence SHALL be the last line of the explanation's paragraph, with no blank line before it, not a paragraph of its own. What the step no longer says SHALL be in that Commands section. A step that is not a command, `seed`, SHALL keep its full explanation and full configuration example, and SHALL link to the headings of the keys it uses, such as `variant.steps`. The Overview SHALL show `VARIANT_STEP_<STEP>=no` as typed.

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

- **WHEN** the built Configuration page is read
- **THEN** its Custom Steps and Custom multi-tenancy steps sections each contain fenced YAML
- **AND** the multi-tenancy section links to the Configuration headings of `db.multi`

#### Scenario: Core carries what the Overview drops

- **WHEN** the built Commands page is read
- **THEN** its `variant provision` and `variant deprovision` sections link to the Configuration headings of `variant.steps` and `db.multi`
- **AND** its `variant watch` section names `--reprovision`

### Requirement: Installation offers the extension first

The installation page SHALL describe installing Variant Worktrees into the reader's existing project as three numbered steps and SHALL NOT repeat what `variant init` does. Step 1 SHALL tell how to install mise (Homebrew and `mise.run`) and SHALL tell the reader to activate it with `mise activate`. Step 2 SHALL offer two ways, in this order. Way 2a, *Extension for VSCode and Cursor*, SHALL say it is tested with Cursor, SHALL name the **Variant Worktrees** extension, SHALL name installing it from the Extensions view of the editor as a way, SHALL link to its pages on the Visual Studio Marketplace and Open VSX, SHALL say that the extension can run the init logic, and SHALL send the reader to its **Onboarding** instructions. Way 2b SHALL show `mise x packslip:jubr/variant-worktrees@ -- variant init` run from the project directory (with a prompt of the form `my-project/ $`), SHALL show example output of that command, and SHALL link to the `variant init` section of Commands (`/guide/commands#variant-init`) for what `init` does and for its flags. Step 3 SHALL tell the reader to review `variants.yaml` and SHALL show an example of it. The page SHALL NOT document installing the TypeScript library or the MCP server; the Development section SHALL. No tracked file under `docs/` SHALL contain `npm install`, `npx` or `bun add`.

#### Scenario: Extension flavor comes first

- **WHEN** the built installation page is read
- **THEN** the extension way precedes the `variant init` way
- **AND** it names the **Variant Worktrees** extension, Cursor and Onboarding, and Homebrew and `mise.run`
- **AND** it links to `https://marketplace.visualstudio.com/items?itemName=jubr.variant-worktrees` and `https://open-vsx.org/extension/jubr/variant-worktrees`

#### Scenario: Steps are in order

- **WHEN** the built installation page is read
- **THEN** its second-level headings are, in order, the mise installation, the extension (*Extension for VSCode and Cursor*), the `variant init` way and the review of `variants.yaml`
- **AND** the extension way precedes the `variant init` way
- **AND** it names Homebrew, `mise.run` and `mise activate`

#### Scenario: Extension way

- **WHEN** the extension section of the built installation page is read
- **THEN** it names the **Variant Worktrees** extension, Cursor and Onboarding, and says it can run the init logic
- **AND** it links to `https://marketplace.visualstudio.com/items?itemName=jubr.variant-worktrees` and `https://open-vsx.org/extension/jubr/variant-worktrees`

#### Scenario: init way links instead of repeating

- **WHEN** the `variant init` section of the built installation page is read
- **THEN** it contains `mise x packslip:jubr/variant-worktrees@ -- variant init` and example output in fenced code
- **AND** it links to `/guide/commands#variant-init`
- **AND** the page does not contain the words `.gitignore` or `mise.toml` outside fenced code

#### Scenario: variants.yaml is reviewed

- **WHEN** the last section of the built installation page is read
- **THEN** it contains fenced YAML with a `variant:` key
- **AND** it links to the Configuration page

### Requirement: db.multi points to the multi-tenancy steps

The `db.multi` section of the Configuration page SHALL link to the heading *Custom multi-tenancy steps* of the Configuration page (`/guide/configuration#custom-multi-tenancy-steps`).

#### Scenario: db.multi links the worked example

- **WHEN** the section `db.multi` of the built Configuration page is read
- **THEN** it links to `/guide/configuration#custom-multi-tenancy-steps`

### Requirement: Site layout

The pages of the site SHALL live in directories that match the sidebar: `index.md` is Getting Started and the landing page, `guide/` holds the Variant Worktrees pages (Overview, Installation, Commands, CLI, Configuration, Runtime, Workspace), `vscode/` holds Extension, MCP server and Socket IPC, `chat-renamer/` holds the Chat Renamer pages, and `development/` holds Building and the library. The Commands page is `guide/commands`. What belongs to the command line itself (the global flags, which include the slug, and the shell completions) SHALL be on `guide/cli`. The library page SHALL hold the command definitions. Where another requirement names a page by an earlier URL or as Core, the page of this layout applies.

#### Scenario: Pages are where the sidebar says

- **WHEN** the built site is listed
- **THEN** it has `index.html`, `guide/commands.html`, `guide/cli.html`, `vscode/extension.html`, `vscode/mcp.html`, `vscode/socket-ipc.html` and `development/library.html`
- **AND** it has no `guide/index.html`, `guide/core.html` or `cli-vscode-webview.html`
- **AND** the built library page has the heading Command definitions

## ADDED Requirements

### Requirement: Overview starts with Installation and ends with next steps

The Overview SHALL have a second-level section *Installation* directly before *Flow of Steps*, as a short explanation that links to the Installation page (`/guide/installation`). The *Flow of Steps* SHALL begin with `create`. The Overview SHALL NOT contain the sections *Custom Steps* and *Custom multi-tenancy steps*; the Configuration page holds them. The last section of the Overview SHALL be the second-level heading *Next steps*. It SHALL be a list whose items each say in a phrase what the reader does or finds there, with a link, and SHALL link to: the Extension (`/vscode/extension`); the Workspace page (`/guide/workspace`) for setting up a workspace around a Git project; the options of `variants.yaml` (`/guide/configuration#variant-options`); the commands of the command line (`/guide/cli` and `/guide/commands`); and Runtime (`/guide/runtime`).

#### Scenario: Installation comes before the flow

- **WHEN** the built Overview page is read
- **THEN** the second-level heading *Installation* is directly followed by the second-level heading *Flow of Steps*
- **AND** the *Installation* section links to `/guide/installation`
- **AND** the first third-level heading below *Flow of Steps* is `create`

#### Scenario: Custom steps moved out

- **WHEN** the built Overview page is read
- **THEN** it has no heading *Custom Steps* and no heading *Custom multi-tenancy steps*

#### Scenario: Next steps end the page

- **WHEN** the built Overview page is read
- **THEN** its last second-level heading is *Next steps*
- **AND** that section is a list whose items link to `/vscode/extension`, `/guide/workspace`, `/guide/configuration#variant-options`, `/guide/cli`, `/guide/commands` and `/guide/runtime`

### Requirement: Custom steps are documented on the Configuration page

The Configuration page SHALL hold the second-level section *Custom Steps*, directly after *Database options*. It SHALL show a step `migrations` with `cmd`, `dir`, `env`, `filterLinesRegex` and `runAfter: seed` in fenced YAML, and SHALL say that `runBefore` and `runAfter` name a builtin step or another custom step, linking to the headings of those keys. It SHALL say that several steps with the same `runBefore` or the same `runAfter` run in the order in which they are written in `variants.yaml`. It SHALL show a step `custom1` with `runAfter: watch` and say that `variant watch` then runs create, provision, seed, watch and custom1. The second-level section *Custom multi-tenancy steps* SHALL follow it, directly before *Templates*, show the multi-tenant example (`schemaPrefix`, `tenantsCmd`, `provision`, `seed`, `migrations` and `deprovision`) in fenced YAML, and link to the headings of `db.multi` and `db.multi.schemaPrefix`.

#### Scenario: Custom steps show their order

- **WHEN** the section *Custom Steps* of the built Configuration page is read
- **THEN** it contains fenced YAML with `runAfter: seed`
- **AND** it says that several steps with the same `runBefore` or `runAfter` run in the order they are defined
- **AND** it contains fenced YAML with a step `custom1` and `runAfter: watch`, and names create, provision, seed, watch and custom1 in that order

#### Scenario: Multi-tenancy steps keep their example

- **WHEN** the section *Custom multi-tenancy steps* of the built Configuration page is read
- **THEN** it contains fenced YAML that sets `provision`, `seed`, `migrations` and `deprovision`
- **AND** it links to the Configuration headings of `db.multi` and `db.multi.schemaPrefix`
