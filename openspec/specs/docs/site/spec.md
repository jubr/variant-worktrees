# docs/site Specification

## Purpose

The published documentation site loads its own styles and product logo on GitHub Pages and presents every page in the dark document shell.

## Requirements

### Requirement: Published asset URLs

The built documentation site SHALL request same-origin stylesheets, scripts, favicons, and the navigation logo under the `/variant-worktrees/` prefix. Each of those URLs SHALL name a file in the build output once that prefix is removed. The site configuration SHALL keep the navigation logo path `/logo-256.png` and the favicon paths `/favicon-32.png` and `/favicon-16.png`.

#### Scenario: Home page assets use the project prefix

- **WHEN** the built home page HTML is read
- **THEN** its stylesheet, script, favicon, and navigation logo URLs start with `/variant-worktrees/`
- **AND** each URL's path after that prefix is a file in the build output

#### Scenario: Configured logo and favicon paths stay unprefixed

- **WHEN** the documentation site configuration is read
- **THEN** the navigation logo is `/logo-256.png`
- **AND** the favicon links are `/favicon-32.png` and `/favicon-16.png`

### Requirement: Dark document shell

Guide pages, the MCP page, and the API reference SHALL render in a document shell with a left sidebar of grouped links, a top navigation bar that shows the product logo and a search control, and a right-hand outline on pages that have headings. Fenced code SHALL include a copy control. The initial appearance SHALL be dark when the reader has no stored preference, and the page SHALL include a control that switches appearance. The dark page background SHALL be `#141414`. The brand accent SHALL be `#EC0000`.

#### Scenario: Installation page shows the shell

- **WHEN** the built installation page is read
- **THEN** it includes the sidebar, a search control, the navigation logo, an outline of its headings, and a copy control on a fenced code block
- **AND** the built page selects the dark appearance when no preference is stored
- **AND** the built stylesheet sets the dark page background to `#141414` and the brand accent to `#EC0000`

#### Scenario: Appearance can be switched

- **WHEN** the built installation page is read
- **THEN** it includes a dark/light appearance switch

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

The sidebar SHALL list Getting Started, then a Variant Worktrees group, then Chat Renamer, then Development. Getting Started SHALL be a link above the Variant Worktrees group and SHALL NOT be an item inside that group. Variant Worktrees SHALL list Core, then Configuration, then Installation, then the editor socket, then the MCP server, then the library. Chat Renamer SHALL include the chat renamer overview and, under it, a configuration page, and SHALL sit above Development. Development SHALL include Building and the API reference. The sidebar SHALL NOT link to a guide about replacing shell scripts.

#### Scenario: Installation page lists the groups in order

- **WHEN** the built installation page is read
- **THEN** the sidebar shows Getting Started, then Variant Worktrees, then Chat Renamer, then Development
- **AND** Core precedes Configuration, which precedes Installation
- **AND** Chat Renamer lists its configuration page under the overview
- **AND** the library link follows the MCP server link
- **AND** Development includes a link to Building
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
