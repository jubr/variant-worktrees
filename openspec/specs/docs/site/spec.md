# docs/site Specification

## Purpose

The published documentation site loads its own styles and product logo on GitHub Pages and presents every page in the dark document shell.

## Requirements

### Requirement: Dark document shell

Guide pages, the MCP page, and the API reference SHALL render in a document shell with a left sidebar of grouped links, a top navigation bar that shows the product logo and a search control, and a right-hand outline on pages that have headings. The outline SHALL list the second- and third-level headings of the page. Fenced code SHALL include a copy control. The initial appearance SHALL be dark when the reader has no stored preference, and the page SHALL include a control that switches appearance. The dark page background SHALL be `#141414`. The brand accent SHALL be `#EC0000`.

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

The top navigation SHALL include links named Guide, Configuration, CLI, and MCP. Guide SHALL open the guide introduction. Configuration SHALL open the configuration guide. CLI SHALL open the CLI command documentation. MCP SHALL open the MCP server page. The top navigation SHALL include a search control and a dark/light appearance switch. The top navigation SHALL link to `https://github.com/jubr/variant-worktrees`. The top navigation SHALL show the repository root `package.json` version prefixed with `v`, and that version SHALL link to `https://github.com/jubr/variant-worktrees/releases`.

#### Scenario: Section links

- **WHEN** the built installation page is read
- **THEN** the top navigation includes Guide, Configuration, CLI, and MCP
- **AND** Guide targets the guide introduction
- **AND** Configuration targets the configuration guide
- **AND** CLI targets the CLI command documentation
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

The sidebar SHALL list Getting Started, then a Variant Worktrees group, then a VSCode / Cursor group, then Chat Renamer, then Development. Getting Started SHALL be a link above the Variant Worktrees group and SHALL NOT be an item inside that group. Variant Worktrees SHALL list Core, then Configuration, then Installation, then Runtime. VSCode / Cursor SHALL list Extension, then the MCP server, then the Socket IPC page, and those three SHALL NOT be items of the Variant Worktrees group. Chat Renamer SHALL include the chat renamer overview and, under it, a configuration page, and SHALL sit above Development. Development SHALL list Building, then the library, then the API reference. The library SHALL NOT be an item of the Variant Worktrees group. The sidebar SHALL NOT link to a guide about replacing shell scripts.

#### Scenario: Installation page lists the groups in order

- **WHEN** the built installation page is read
- **THEN** the sidebar shows Getting Started, then Variant Worktrees, then VSCode / Cursor, then Chat Renamer, then Development
- **AND** Core precedes Configuration, which precedes Installation, which precedes Runtime
- **AND** Runtime precedes the VSCode / Cursor group, which lists Extension, then the MCP server, then the Socket IPC page
- **AND** Chat Renamer lists its configuration page under the overview
- **AND** Development lists Building, then the library, then the API reference
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

### Requirement: API reference from a fresh checkout

`bun run docs:api` SHALL generate the API reference when workspace `dist` directories are absent. Before TypeDoc runs, it SHALL build every workspace package that `variant-api` imports and that publishes types only from `dist`, including `variant-log`.

#### Scenario: variant-log has not been built

- **WHEN** `packages/variant-log/dist` is absent and `bun run docs:api` runs
- **THEN** the command exits successfully
- **AND** TypeDoc does not report that the module `variant-log` cannot be found

### Requirement: Installation into an existing project

The installation page SHALL describe installing Variant Worktrees into the reader's existing project, in two flavors: the mise CLI first, then the VS Code extension. The mise flavor SHALL tell how to install mise (Homebrew and `mise.run`) and SHALL show `mise x github:jubr/variant-worktrees@latest -- variant init` run in the reader's project, followed by an explanation of what `init` does. The extension flavor SHALL say it is tested with Cursor, SHALL name the **Variant Worktrees** extension, and SHALL send the reader to its **Onboarding** instructions. The page SHALL link to Development for the other type of installation. The page SHALL NOT document installing the TypeScript library or the MCP server; the Development section SHALL. No tracked file under `docs/` SHALL contain `npm install`, `npx` or `bun add`.

#### Scenario: Mise flavor comes first

- **WHEN** the built installation page is read
- **THEN** it contains `mise x github:jubr/variant-worktrees@latest -- variant init`
- **AND** the mise flavor precedes the extension flavor
- **AND** it names Homebrew and `mise.run`, and the **Variant Worktrees** extension, Cursor and Onboarding
- **AND** it links to Development

#### Scenario: No npm installation

- **WHEN** tracked files under `docs/` are searched
- **THEN** none contain `npm install`, `npx` or `bun add`

#### Scenario: Library and MCP installation live in Development

- **WHEN** the built Development pages are read
- **THEN** one explains installing the TypeScript library and the MCP server from a checkout of this repository
- **AND** the installation page names neither `variant-api` nor `variant-mcp` as something to install

### Requirement: Runtime page

A top-level Runtime page SHALL document how watches behave: how `up` and `watch` prepare a variant, ports, state files, the interactive keys, exit statuses, the environment read through Mise, the variables a command sees or reads as overrides, and what is detected when `variant.watches` is omitted. The Configuration page SHALL NOT repeat those sections.

#### Scenario: Runtime holds the moved sections

- **WHEN** the built Runtime page is read
- **THEN** it has headings Runtime, Environment through Mise, Environment variables and When watches are omitted
- **AND** the built Configuration page has none of those headings

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
- **AND** the Extension page links to `/mcp`, `/guide/socket-ipc`, `/guide/configuration` and `/guide/runtime`

### Requirement: Library page shows code

The library page SHALL consist of code examples with a one-line caption each, and SHALL link to Core for what a command does.

#### Scenario: Library links into Core

- **WHEN** the built library page is read
- **THEN** it contains fenced code for `createVariantClient`
- **AND** it links to `/guide/core`

### Requirement: Configuration page structure

The Configuration page SHALL open with an Options section. The Options section SHALL give every key of `variant` in `variants.yaml` its own heading named `variant.<key>`, in alphabetical order, so other pages can link to it. Templates SHALL follow the options, and Unknown keys and migration SHALL be the last section.

#### Scenario: Every option has an anchor

- **WHEN** the built Configuration page is read
- **THEN** each key of `variant` in the `variants.yaml` schema has a heading `variant.<key>`, for example `variant.abbr` and `variant.baseBranch`

#### Scenario: Options are alphabetical

- **WHEN** the `variant.<key>` headings of the Options section are listed in page order
- **THEN** they equal the same list sorted alphabetically

#### Scenario: Section order

- **WHEN** the second-level headings of the Configuration page are listed
- **THEN** Options comes first, Templates comes after it, and Unknown keys and migration comes last

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
