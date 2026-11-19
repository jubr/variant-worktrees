## RENAMED Requirements

- FROM: `### Requirement: Core groups lifecycle commands`
- TO: `### Requirement: Commands groups lifecycle commands`

## REMOVED Requirements

### Requirement: API reference from a fresh checkout

**Reason**: the site no longer has a generated API reference, so TypeDoc is not part of the docs build.

**Migration**: none; the library page shows the client and the command definitions.

### Requirement: Installation into an existing project

**Reason**: the installation page shows the extension flavor first and no longer links to Development.

**Migration**: see the requirement Installation offers the extension first.

## MODIFIED Requirements

### Requirement: Sidebar groups

The sidebar SHALL list Getting Started, then a Variant Worktrees group, then a VSCode / Cursor group, then Chat Renamer, then Development. Getting Started SHALL be a link to the site root above the Variant Worktrees group and SHALL NOT be an item inside that group. Variant Worktrees SHALL list Overview, then Commands, then CLI, then Configuration, then Installation, then Runtime, then Workspace. VSCode / Cursor SHALL list Extension, then the MCP server, then the Socket IPC page, and those three SHALL NOT be items of the Variant Worktrees group. Chat Renamer SHALL include the page named Extension and, under it, a configuration page, and SHALL sit above Development. Development SHALL list Building, then the library. The library SHALL NOT be an item of the Variant Worktrees group. The sidebar SHALL NOT link to a guide about replacing shell scripts.

#### Scenario: Installation page lists the groups in order

- **WHEN** the built installation page is read
- **THEN** the sidebar shows Getting Started, then Variant Worktrees, then VSCode / Cursor, then Chat Renamer, then Development
- **AND** Commands precede CLI, which precedes Configuration, which precedes Installation, which precedes Runtime, which precedes Workspace
- **AND** Workspace precedes the VSCode / Cursor group, which lists Extension, then the MCP server, then the Socket IPC page
- **AND** Chat Renamer lists its configuration page under the Extension page
- **AND** Development lists Building, then the library
- **AND** the page does not link to `/guide/scripts`

### Requirement: Top navigation

The top navigation SHALL include links named Configuration, CLI, and MCP, and SHALL NOT include a link named Guide. Configuration SHALL open the configuration guide. CLI SHALL open the CLI page. MCP SHALL open the MCP server page. The top navigation SHALL include a search control and a dark/light appearance switch. The top navigation SHALL link to `https://github.com/jubr/variant-worktrees`. The top navigation SHALL show the repository root `package.json` version prefixed with `v`, and that version SHALL link to `https://github.com/jubr/variant-worktrees/releases`.

#### Scenario: Section links

- **WHEN** the built installation page is read
- **THEN** the top navigation includes Configuration, CLI, and MCP, and no Guide
- **AND** Configuration targets the configuration guide
- **AND** CLI targets `/guide/cli`
- **AND** MCP targets the MCP server page

#### Scenario: Search and dark/light switch

- **WHEN** the built installation page is read
- **THEN** the top navigation includes a search control and a dark/light appearance switch

#### Scenario: Repository, version, and releases

- **WHEN** the built installation page is read
- **THEN** the top navigation links to `https://github.com/jubr/variant-worktrees`
- **AND** it shows `v` followed by the `version` in the repository root `package.json`
- **AND** that version links to `https://github.com/jubr/variant-worktrees/releases`

### Requirement: Dark document shell

Guide pages and the MCP page SHALL render in a document shell with a left sidebar of grouped links, a top navigation bar that shows the product logo and a search control, and a right-hand outline on pages that have headings. The outline SHALL list the second- and third-level headings of the page. Fenced code SHALL include a copy control. The initial appearance SHALL be dark when the reader has no stored preference, and the page SHALL include a control that switches appearance. The dark page background SHALL be `#141414`. The brand accent SHALL be `#EC0000`.

#### Scenario: Installation page shows the shell

- **WHEN** the built installation page is read
- **THEN** it includes the sidebar, a search control, the navigation logo, an outline of its headings, and a copy control on a fenced code block
- **AND** the built page selects the dark appearance when no preference is stored
- **AND** the built stylesheet sets the dark page background to `#141414` and the brand accent to `#EC0000`

#### Scenario: Appearance can be switched

- **WHEN** the built installation page is read
- **THEN** it includes a dark/light appearance switch

#### Scenario: Outline covers second and third level

- **WHEN** the documentation site configuration is read
- **THEN** the outline levels are 2 and 3
- **AND** the built Configuration page has the third-level heading `variant.abbr` and the second-level heading Templates

### Requirement: Internal links resolve

Every internal link in a built page of the documentation site (a link that is not to another origin), resolved against its page, SHALL name a file in the build output, and when it has a fragment, an element with that `id` in that file. This covers links in the page content, the navigation bar, the sidebar and the footer, including links written as raw HTML.

#### Scenario: Every internal link names a file

- **WHEN** every internal `href` of every built HTML page is resolved against its page
- **THEN** each resolves to a file in the build output, where a path without extension or with a trailing slash names the `.html` file or the `index.html` of that path

#### Scenario: The check sees links the build does not

- **WHEN** the test collects links from the built pages
- **THEN** it includes the navigation and sidebar links and at least one link in the page content

### Requirement: Sentences are on separate lines

Prose in the Markdown files under `docs/` SHALL put each sentence on a line of its own, which Markdown renders as one paragraph. Consecutive sentences MAY share a line while the line stays below 100 characters. This applies to paragraphs and list items, and not to headings, tables, fenced code, HTML or front matter. A repository test SHALL fail for a file whose prose differs from what the rule produces, and a script SHALL rewrite a file to comply.

#### Scenario: A long sentence has its own line

- **WHEN** a paragraph holds two sentences of which the combined line would be 100 characters or more
- **THEN** they are on two lines

#### Scenario: Short sentences share a line

- **WHEN** two consecutive sentences together are shorter than 100 characters
- **THEN** a file that puts them on separate lines fails the test

#### Scenario: Every docs file complies

- **WHEN** the rule is applied to each tracked Markdown file under `docs/`
- **THEN** the result equals the file

### Requirement: Commands groups lifecycle commands

The Commands page SHALL have the second-level sections *Lifecycle commands* and *Other commands*. *Lifecycle commands* SHALL hold `init` first, then `create`, `provision`, `up`, `watch`, `down`, `deprovision` and `implode` as third-level headings, in the order of the flow of steps after `init`. *Other commands* SHALL hold `config`, `list`, `status` and `ui` as third-level headings. Every command heading keeps the id of its name, so `commands#create` stays a valid deep link.

#### Scenario: Commands are grouped

- **WHEN** the headings of the built Commands page are listed in page order
- **THEN** the second-level headings are Lifecycle commands and Other commands
- **AND** the third-level headings below Lifecycle commands are `init`, `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode`
- **AND** the third-level headings below Other commands are `config`, `list`, `status`, `ui`

### Requirement: Overview steps are short and link to commands

Each builtin step of the Overview that is also a command (`create`, `provision`, `watch`, `down`, `deprovision`, `implode`) SHALL be a minimal explanation of what the step does, of at most 60 words, with no list, no table, no flag or option list and no configuration example. It SHALL end with the sentence `More details at Commands [<command>](commands#<command>).`, linking to the section of that command in Commands. That sentence SHALL be the last line of the explanation's paragraph, with no blank line before it, not a paragraph of its own. What the step no longer says SHALL be in that Commands section. A step that is not a command, `seed`, and the Custom Steps and Custom multi-tenancy steps sections SHALL keep their full explanation and full configuration example, and SHALL link to the headings of the keys they use, such as `variant.steps`, `db.multi` and `db.multi.schemaPrefix`. The Overview SHALL show `VARIANT_STEP_<STEP>=no` as typed.

#### Scenario: Command steps are short and end with a Core link

- **WHEN** the section of each of `create`, `provision`, `watch`, `down`, `deprovision` and `implode` in the built Overview page is read
- **THEN** it has at most 60 words before the sentence `More details at Commands` and contains no list, table or fenced code
- **AND** that sentence is in the last paragraph of the section, which also holds the explanation, and it ends with a link whose text is the command and whose target is `/guide/commands#<command>`, and a period

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
- **THEN** its `provision` and `deprovision` sections link to the Configuration headings of `variant.steps` and `db.multi`
- **AND** its `watch` section names `--reprovision`

## ADDED Requirements

### Requirement: Installation offers the extension first

The installation page SHALL describe installing Variant Worktrees into the reader's existing project, in two flavors: the VS Code extension first, then the mise CLI. The extension flavor SHALL say it is tested with Cursor, SHALL name the **Variant Worktrees** extension, SHALL name installing it from the Extensions view of the editor as a way, SHALL link to its pages on the Visual Studio Marketplace and Open VSX, and SHALL send the reader to its **Onboarding** instructions. The mise flavor SHALL tell how to install mise (Homebrew and `mise.run`) and SHALL show `mise x github:jubr/variant-worktrees@latest -- variant init` run in the reader's project, followed by an explanation of what `init` does. The page SHALL NOT document installing the TypeScript library or the MCP server; the Development section SHALL. No tracked file under `docs/` SHALL contain `npm install`, `npx` or `bun add`.

#### Scenario: Extension flavor comes first

- **WHEN** the built installation page is read
- **THEN** the extension flavor precedes the mise flavor
- **AND** it names the **Variant Worktrees** extension, Cursor and Onboarding, and Homebrew and `mise.run`
- **AND** it contains `mise x github:jubr/variant-worktrees@latest -- variant init`
- **AND** it links to `https://marketplace.visualstudio.com/items?itemName=jubr.variant-worktrees` and `https://open-vsx.org/extension/jubr/variant-worktrees`

### Requirement: db.multi points to the multi-tenancy steps

The `db.multi` section of the Configuration page SHALL link to the heading *Custom multi-tenancy steps* of the Overview (`/guide/overview#custom-multi-tenancy-steps`).

#### Scenario: db.multi links the worked example

- **WHEN** the section `db.multi` of the built Configuration page is read
- **THEN** it links to `/guide/overview#custom-multi-tenancy-steps`

### Requirement: Palette Commands

The Extension page and the Chat Renamer Extension page SHALL each have a second-level section *Palette Commands* that lists every command the extension shows in the command palette, by its title, and says what it does.

#### Scenario: Both extension pages list their commands

- **WHEN** the built Extension page and the built Chat Renamer Extension page are read
- **THEN** each has the heading *Palette Commands*

### Requirement: Workspace page

A page *Workspace*, the last page of the Variant Worktrees group, SHALL describe an ideal workspace for the tool. It SHALL show an ASCII tree whose root directory is `vw` and which holds the main checkout, one or two `_v-*` variant worktrees as siblings of it, `AGENTS.md`, `CONTRIBUTING.md` and `.agents` as symlinks into the main checkout (marked as such), and a `_ref` directory that `.cursorindexingignore` names. It SHALL give the reasoning for the layout, including why the worktrees are siblings of the primary checkout on `main`.

#### Scenario: Workspace page shows and explains the layout

- **WHEN** the built Workspace page is read
- **THEN** it has a fenced tree that starts at `vw` and shows `_ref`, `.cursorindexingignore`, the three symlinks and at least one `_v-` directory
- **AND** it explains why the worktrees are siblings of the main checkout

### Requirement: Site layout

The pages of the site SHALL live in directories that match the sidebar: `index.md` is Getting Started and the landing page, `guide/` holds the Variant Worktrees pages (Overview, Commands, CLI, Configuration, Installation, Runtime, Workspace), `vscode/` holds Extension, MCP server and Socket IPC, `chat-renamer/` holds the Chat Renamer pages, and `development/` holds Building and the library. The Commands page is `guide/commands`. What belongs to the command line itself (the slug argument, the global flags and the shell completions) SHALL be on `guide/cli`. The library page SHALL hold the command definitions. Where another requirement names a page by an earlier URL or as Core, the page of this layout applies.

#### Scenario: Pages are where the sidebar says

- **WHEN** the built site is listed
- **THEN** it has `index.html`, `guide/commands.html`, `guide/cli.html`, `vscode/extension.html`, `vscode/mcp.html`, `vscode/socket-ipc.html` and `development/library.html`
- **AND** it has no `guide/index.html`, `guide/core.html` or `cli-vscode-webview.html`
- **AND** the built library page has the heading Command definitions
