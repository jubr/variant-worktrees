## MODIFIED Requirements

### Requirement: Sidebar groups

The sidebar SHALL list Getting Started, then a Variant Worktrees group, then a VSCode / Cursor group, then Chat Renamer, then Development. Getting Started SHALL be a link above the Variant Worktrees group and SHALL NOT be an item inside that group. Variant Worktrees SHALL list Core, then Configuration, then Installation, then Runtime, then Workspace. VSCode / Cursor SHALL list Extension, then the MCP server, then the Socket IPC page, and those three SHALL NOT be items of the Variant Worktrees group. Chat Renamer SHALL include the page named Extension and, under it, a configuration page, and SHALL sit above Development. Development SHALL list Building, then the library, then the API reference. The library SHALL NOT be an item of the Variant Worktrees group. The sidebar SHALL NOT link to a guide about replacing shell scripts.

#### Scenario: Installation page lists the groups in order

- **WHEN** the built installation page is read
- **THEN** the sidebar shows Getting Started, then Variant Worktrees, then VSCode / Cursor, then Chat Renamer, then Development
- **AND** Core precedes Configuration, which precedes Installation, which precedes Runtime, which precedes Workspace
- **AND** Workspace precedes the VSCode / Cursor group, which lists Extension, then the MCP server, then the Socket IPC page
- **AND** Chat Renamer lists its configuration page under the Extension page
- **AND** Development lists Building, then the library, then the API reference
- **AND** the page does not link to `/guide/scripts`

### Requirement: Core groups lifecycle commands

The Core page SHALL have the second-level sections *Lifecycle commands* and *Other commands*, followed by *Global flags*. *Lifecycle commands* SHALL hold `init` first, then `create`, `provision`, `up`, `watch`, `down`, `deprovision` and `implode` as third-level headings, in the order of the flow of steps after `init`. *Other commands* SHALL hold `config`, `list`, `status`, `ui` and `completions` as third-level headings. Every command heading keeps the id of its name, so `core#create` stays a valid deep link.

#### Scenario: Commands are grouped

- **WHEN** the headings of the built Core page are listed in page order
- **THEN** the second-level headings are Lifecycle commands, Other commands and Global flags
- **AND** the third-level headings below Lifecycle commands are `init`, `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode`
- **AND** the third-level headings below Other commands are `config`, `list`, `status`, `ui`, `completions`

### Requirement: Overview steps are short and link to commands

Each builtin step of the Overview that is also a command (`create`, `provision`, `watch`, `down`, `deprovision`, `implode`) SHALL be a minimal explanation of what the step does, of at most 60 words, with no list, no table, no flag or option list and no configuration example. It SHALL end with the sentence `More details at Core [<command>](core#<command>).`, linking to the section of that command in Core. That sentence SHALL be the last line of the explanation's paragraph, with no blank line before it, not a paragraph of its own. What the step no longer says SHALL be in that Core section. A step that is not a command, `seed`, and the Custom Steps and Custom multi-tenancy steps sections SHALL keep their full explanation and full configuration example, and SHALL link to the headings of the keys they use, such as `variant.steps`, `db.multi` and `db.multi.schemaPrefix`. The Overview SHALL show `VARIANT_STEP_<STEP>=no` as typed.

#### Scenario: Command steps are short and end with a Core link

- **WHEN** the section of each of `create`, `provision`, `watch`, `down`, `deprovision` and `implode` in the built Overview page is read
- **THEN** it has at most 60 words before the sentence `More details at Core` and contains no list, table or fenced code
- **AND** that sentence is in the last paragraph of the section, which also holds the explanation, and it ends with a link whose text is the command and whose target is `/guide/core#<command>`, and a period

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

- **WHEN** the built Core page is read
- **THEN** its `provision` and `deprovision` sections link to the Configuration headings of `variant.steps` and `db.multi`
- **AND** its `watch` section names `--reprovision`

## ADDED Requirements

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
