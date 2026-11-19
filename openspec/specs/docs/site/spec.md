# docs/site Specification

## Purpose

The published documentation site loads its own styles and product logo on GitHub Pages and presents every page in the dark document shell.

## Requirements

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

### Requirement: Getting started

The getting started page SHALL open with a short introduction, then explain how a variant runs, then how to install the CLI in another project. It SHALL describe Variant Worktrees as a CLI, an MCP server, a VS Code extension, and a library. It SHALL show an agent workflow and a human workflow that run `variant watch` and `variant implode` for the slug `feature-forty-two`. It SHALL document `mise use github:jubr/variant-worktrees` and link to `https://mise.jdx.dev`. It SHALL point at the configuration guide. Its requirements SHALL name the `variant` CLI and SHALL name PostgreSQL, MySQL, and SQLite as optional. Tracked files under `docs/` SHALL NOT contain `VARIANT_API_KEY` or `cleye`.

#### Scenario: Getting started shows both workflows

- **WHEN** the built getting started page is read
- **THEN** it contains `mise use github:jubr/variant-worktrees` and a link to `https://mise.jdx.dev`
- **AND** how a variant runs precedes that install command
- **AND** it contains `variant watch -s feature-forty-two` and `cd _v-feature-forty-two`
- **AND** it names PostgreSQL, MySQL, and SQLite as optional
- **AND** it links to the configuration guide

#### Scenario: Docs omit the removed names

- **WHEN** tracked files under `docs/` are searched
- **THEN** none contain `VARIANT_API_KEY` or `cleye`

### Requirement: Building from source

Development SHALL include a Building page that documents building a checkout with Bun, `task bootstrap`, and `task build`.

#### Scenario: Building page names the toolchain

- **WHEN** the built Building page is read
- **THEN** it contains `Bun`, `task bootstrap`, and `task build`

### Requirement: Landing page uses the document shell

The landing page SHALL use the same sidebar and top navigation as the guide. It SHALL NOT hide the sidebar.

#### Scenario: Landing page shows the sidebar

- **WHEN** the built home page is read
- **THEN** it includes the sidebar and the navigation logo

### Requirement: No remote personal-site attribution

Tracked files under `docs/` and the built HTML SHALL NOT contain `zach.dev` or `statue.png`. The built site SHALL NOT include a fixed corner image.

#### Scenario: Sources omit the remote attribution

- **WHEN** tracked files under `docs/` are searched
- **THEN** none contain `zach.dev` or `statue.png`

#### Scenario: Built home page omits the remote attribution

- **WHEN** the built home page HTML is read
- **THEN** it does not contain `zach.dev` or `statue.png`
- **AND** it does not include a fixed corner image

### Requirement: Runtime page

A top-level Runtime page SHALL document how watches behave: how `up` and `watch` prepare a variant, ports, state files, the interactive keys, exit statuses, the environment read through Mise, the variables a command sees or reads as overrides, and what is detected when `variant.watches` is omitted. The Configuration page SHALL NOT repeat those sections. The Runtime page SHALL have a second-level heading Watching with the third-level headings Interactive keys, Reattaching and Exit status below it, followed by a second-level heading Up that holds what is specific to `up`. The Up section SHALL say that `up` goes through `create`, `provision` and `seed` like `watch`, SHALL NOT say that it recreates the database target, and SHALL show the disclaimer that `up` is not thoroughly tested as an info panel.

#### Scenario: Runtime holds the moved sections

- **WHEN** the built Runtime page is read
- **THEN** it has headings Runtime, Environment through Mise, Environment variables and When watches are omitted
- **AND** the built Configuration page has none of those headings

#### Scenario: Watching holds the attached-watch behavior

- **WHEN** the headings of the built Runtime page are listed in page order
- **THEN** Watching is a second-level heading and Interactive keys, Reattaching and Exit status are third-level headings directly below it
- **AND** Up is a second-level heading that follows the Exit status heading and precedes Environment through Mise

#### Scenario: Up goes through the same steps as watch

- **WHEN** the Up section of the built Runtime page is read
- **THEN** it names `create`, `provision` and `seed` and does not say that `up` recreates the database target
- **AND** it contains a VitePress info container with the disclaimer

### Requirement: Extension page

An Extension page, the first page of the VSCode / Cursor group, SHALL document the behavior of the VS Code extension: the Variants view and panel, onboarding, the MCP server it registers, and the chat renamer it embeds.

#### Scenario: Extension page documents the editor

- **WHEN** the built Extension page is read
- **THEN** it mentions the Variants view, Onboarding, the registered MCP server and the chat renamer

### Requirement: Cross-links into the VSCode / Cursor group

Getting Started, Installation, Core, Configuration, Runtime and the library page SHALL link to the Extension page. Getting Started, Installation and the library page SHALL link to the MCP server page. Runtime SHALL link to the Socket IPC page. The Extension page SHALL link to the MCP server page and the Socket IPC page. The Extension, MCP server and Socket IPC pages SHALL each link to Installation. The Extension page SHALL link to Configuration and Runtime.

#### Scenario: Pages link into the group

- **WHEN** the built Getting Started, Installation, Core, Configuration, Runtime and library pages are read
- **THEN** each contains a link to `/guide/extension`
- **AND** the Getting Started, Installation and library pages also link to `/mcp`
- **AND** the Runtime page links to `/guide/socket-ipc`

#### Scenario: The group links back

- **WHEN** the built Extension, MCP server and Socket IPC pages are read
- **THEN** each links to `/guide/installation`
- **AND** the Extension page links to `/mcp`, `/guide/configuration` and `/guide/runtime`

### Requirement: Library page shows code

The library page SHALL consist of code examples with a one-line caption each, and SHALL link to Core for what a command does. Its configuration section SHALL be a list of deep links into the Configuration page and SHALL NOT repeat a sample `variants.yaml`.

#### Scenario: Library links into Core

- **WHEN** the built library page is read
- **THEN** it contains fenced code for `createVariantClient`
- **AND** it links to `/guide/core`

#### Scenario: Library configuration links to the options

- **WHEN** the configuration section of the built library page is read
- **THEN** it links to `/guide/configuration#variant-watches`, `/guide/configuration#variant-seed` and `/guide/configuration#variant-mise`
- **AND** it contains no fenced code

### Requirement: Configuration page structure

The Configuration page SHALL have the second-level sections *Variant options*, *Chat Renamer options*, *Database options*, *Templates* and *Unknown keys and migration*, in this order. *Variant options* SHALL give every key of `variant` in `variants.yaml` its own heading named `variant.<key>`, in alphabetical order, so other pages can link to it. Every sub-key of those options SHALL have a third-level heading of its own named with its full path (`variant.implode.maxDiffLines`, `variant.mise.binPath`, `variant.watches.<key>.dir`, `variant.steps.<name>.cmd`), directly after its parent and in alphabetical order. *Chat Renamer options* SHALL link to the Chat Renamer configuration page and has no heading per key. *Database options* SHALL have a third-level heading for every key of `db` and every key of `db.multi` (`db.ssl`, `db.multi.tenantsCmd`). The `variant.steps` section SHALL link to `overview#flow-of-steps`. *Templates* SHALL list every placeholder and environment form in a table with the columns Item, Meaning, Example use and Example value, and no column for the pass. *Unknown keys and migration* SHALL be the last section and SHALL NOT name a key or shape of an earlier version.

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
- **THEN** they are Variant options, Chat Renamer options, Database options, Templates and Unknown keys and migration

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

### Requirement: Relocatable asset URLs

The built documentation site SHALL request its own stylesheets, scripts, favicons, and the navigation logo with URLs that are relative to the requesting page, so the same build works under any path. No such URL SHALL be root-absolute, and none SHALL contain the `/variant-worktrees/` prefix. Each of those URLs, resolved against its page, SHALL name a file in the build output. The site configuration SHALL set a relative base, SHALL keep the navigation logo path `/logo-256.png`, and SHALL keep `cleanUrls` off. Favicon links SHALL stay valid on pages of every depth.

#### Scenario: Home page assets are relative

- **WHEN** the built home page HTML is read
- **THEN** its stylesheet, script, favicon, and navigation logo URLs do not start with `/`
- **AND** each URL, resolved against the home page, is a file in the build output

#### Scenario: Nested pages resolve their assets

- **WHEN** the built `guide/installation.html` is read
- **THEN** its stylesheet, script, favicon, and navigation logo URLs do not start with `/`
- **AND** each URL, resolved against that page, is a file in the build output

#### Scenario: Site configuration is relocatable

- **WHEN** the documentation site configuration is read
- **THEN** its base is `./`
- **AND** the navigation logo is `/logo-256.png`
- **AND** `cleanUrls` is not enabled

### Requirement: Code does not use ligatures

Code on the documentation site, inline and fenced, SHALL show every character as typed. The built stylesheet SHALL turn font ligatures and contextual alternates off for `code` and `pre`, so `>=`, `<=`, `=>`, `!=` and `->` are not drawn as one glyph. The page text SHALL keep the typed characters.

#### Scenario: Stylesheet turns ligatures off for code

- **WHEN** the built stylesheet is read
- **THEN** a rule for `code` and `pre` sets `font-variant-ligatures` to `none`
- **AND** the same rule turns the `calt` and `liga` font features off

#### Scenario: Inline code keeps the typed characters

- **WHEN** the built Overview page is read
- **THEN** its inline code contains `VARIANT_STEP_<STEP>=no` with the characters `<`, `>` and `=` as text (escaped in HTML only)

### Requirement: Links target headings

A link from one documentation page to another SHALL target the heading that explains the topic whenever such a heading exists, as in `overview#flow-of-steps`, `core#init` and `configuration#variant-steps`. Every internal link that has a fragment SHALL name an `id` that exists in its built target page.

#### Scenario: No link has a dead fragment

- **WHEN** every internal link with a fragment in the built site is resolved against its target page
- **THEN** the target page contains an element with that `id`

#### Scenario: Pages link into the heading that explains the topic

- **WHEN** the built Getting Started, Configuration, Core, Installation, Extension and Socket IPC pages are read
- **THEN** Getting Started links to `/guide/overview#flow-of-steps`
- **AND** the `variant.steps` section of Configuration links to `/guide/overview#flow-of-steps`
- **AND** Core links to Configuration headings, not to the top of Configuration, where it names a key
- **AND** Socket IPC links to `/guide/runtime`, the Extension page links to `/guide/runtime#watching`

### Requirement: Internal links resolve

Every internal link in a built page of the documentation site (a link that is not to another origin), resolved against its page, SHALL name a file in the build output, and when it has a fragment, an element with that `id` in that file. This covers links in the page content, the navigation bar, the sidebar and the footer, including links written as raw HTML.

#### Scenario: Every internal link names a file

- **WHEN** every internal `href` of every built HTML page is resolved against its page
- **THEN** each resolves to a file in the build output, where a path without extension or with a trailing slash names the `.html` file or the `index.html` of that path

#### Scenario: The check sees links the build does not

- **WHEN** the test collects links from the built pages
- **THEN** it includes the navigation and sidebar links and at least one link in the page content

### Requirement: Configuration schema is documented

Every property path below the top-level sections `db`, `variant` and `chatRenamer` of the `variants.yaml` JSON schema (`packages/variant-config/variants.yaml.schema.json`, which the `variant-config` and `chat-renamer-config` packages generate) SHALL have a heading of its own on the Configuration page or the Chat Renamer configuration page, named with the full path. A path through a user-chosen name SHALL be written with a placeholder: `<key>` for a watch and `<name>` for a step. The former per-variant state schema `variants.local.yaml.schema.json` is exempt.

#### Scenario: Every schema path has a heading

- **WHEN** all property paths of the `variants.yaml` JSON schema are listed (objects and leaves, such as `db.ssl`, `db.multi.tenantsCmd`, `variant.supervise.readyTimeoutSeconds` and `chatRenamer.awake.cmd`)
- **THEN** each one is the text of a heading of the built Configuration page or the built Chat Renamer configuration page

#### Scenario: A key without documentation fails

- **WHEN** a property is added to the schema and no heading is added
- **THEN** the documentation test fails and names the path

### Requirement: Configuration keys are links

Every inline-code mention in the documentation of a full key path that has a heading on the Configuration page or the Chat Renamer configuration page, such as `variant.baseBranch`, `variant.mise.binPath`, `variant.watches.<key>.dir`, `db.multi`, `chatRenamer.trigger` or `chatRenamer.awake.when`, SHALL be a link to that heading. A heading is exempt from this, and so is fenced code.

#### Scenario: A mentioned key links to its heading

- **WHEN** the built pages are read
- **THEN** each inline `code` element outside a heading and outside fenced code whose text is the path of a heading of the Configuration or the Chat Renamer configuration page is the content of a link to that heading
- **AND** the check finds at least one such mention on each of Overview, Runtime, Core, Library and Extension

#### Scenario: Chat Renamer pages link to the Chat Renamer keys

- **WHEN** the built Chat Renamer overview page mentions `chatRenamer.trigger`
- **THEN** the mention links to `/chat-renamer/configuration#chatrenamer-trigger`

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

### Requirement: MCP tools have a heading each

The *Available tools* section of the MCP server page SHALL have one third-level heading per registered tool, named as the tool (`variant_init`), in the order of the commands. Each tool section SHALL link to the section of the same command in Core (`variant_init` to `/guide/core#init`), SHALL state only what differs from that command, and SHALL show a table of the parameters the tool takes. Arguments a tool fixes itself SHALL NOT be in the table. The page SHALL NOT have a Testing section.

#### Scenario: One heading per registered tool

- **WHEN** the third-level headings of *Available tools* in the built MCP page are listed
- **THEN** they equal `variant_<name>` for every registered command, in registration order

#### Scenario: No Testing section

- **WHEN** the headings of the built MCP page are listed
- **THEN** none is named Testing

#### Scenario: Each tool links to Core and lists its parameters

- **WHEN** the section of a tool in the built MCP page is read
- **THEN** it links to the Core heading of the command of that name
- **AND** its table has one row per argument the tool takes
- **AND** the table has no row for an argument the tool fixes

### Requirement: Chat Renamer configuration page structure

The Chat Renamer configuration page SHALL be structured like the Configuration page: it SHALL open with an Options section, SHALL give every key of `chatRenamer` in the `variants.yaml` schema a third-level heading named `chatRenamer.<key>` and every sub-key a third-level heading named with its full path (`chatRenamer.awake.when`), in alphabetical order, and SHALL end with the editor settings that are not `variants.yaml` keys.

#### Scenario: Every chat renamer key has a heading

- **WHEN** the built Chat Renamer configuration page is read
- **THEN** each key and sub-key of `chatRenamer` in the `variants.yaml` schema has a third-level heading of its full path, for example `chatRenamer.trigger` and `chatRenamer.awake.graceDelaySecs`

#### Scenario: The defaults of activationPatterns are shown

- **WHEN** the `chatRenamer.activationPatterns` section of the built Chat Renamer configuration page is read
- **THEN** its YAML snippet lists exactly the default activation patterns of `chat-renamer-config`, in order

#### Scenario: Chat renamer headings are alphabetical

- **WHEN** the `chatRenamer.` headings of the Options section are listed in page order
- **THEN** they equal the same list sorted alphabetically by full path

### Requirement: No earlier configuration shapes in the docs

The documentation SHALL NOT name configuration keys or shapes of earlier versions. Files that use them SHALL keep loading, without any mention in the docs.

#### Scenario: Docs omit the earlier names

- **WHEN** tracked files under `docs/` are searched
- **THEN** none contain `variant.instances`, `variant.reservedPorts`, `reservedPorts`, `variants.local.yaml` or `.cache/variants/`
- **AND** none says that `{{...}}` templates, a list of `steps` or a `run` key without `cmd` still load

### Requirement: Commands groups lifecycle commands

The Commands page SHALL have the second-level sections *Lifecycle commands* and *Other commands*. *Lifecycle commands* SHALL hold `init` first, then `create`, `provision`, `up`, `watch`, `down`, `deprovision` and `implode` as third-level headings, in the order of the flow of steps after `init`. *Other commands* SHALL hold `config`, `list`, `status` and `ui` as third-level headings. Every command heading keeps the id of its name, so `commands#create` stays a valid deep link.

#### Scenario: Commands are grouped

- **WHEN** the headings of the built Commands page are listed in page order
- **THEN** the second-level headings are Lifecycle commands and Other commands
- **AND** the third-level headings below Lifecycle commands are `init`, `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode`
- **AND** the third-level headings below Other commands are `config`, `list`, `status`, `ui`

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
