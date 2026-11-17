## MODIFIED Requirements

### Requirement: Sidebar groups

The sidebar SHALL list Getting Started, then a Variant Worktrees group, then a VSCode / Cursor group, then Chat Renamer, then Development. Getting Started SHALL be a link above the Variant Worktrees group and SHALL NOT be an item inside that group. Variant Worktrees SHALL list Core, then Configuration, then Installation, then Runtime, then the library. VSCode / Cursor SHALL list Extension, then the MCP server, then the Socket IPC page, and those three SHALL NOT be items of the Variant Worktrees group. Chat Renamer SHALL include the chat renamer overview and, under it, a configuration page, and SHALL sit above Development. Development SHALL include Building and the API reference. The sidebar SHALL NOT link to a guide about replacing shell scripts.

#### Scenario: Installation page lists the groups in order

- **WHEN** the built installation page is read
- **THEN** the sidebar shows Getting Started, then Variant Worktrees, then VSCode / Cursor, then Chat Renamer, then Development
- **AND** Core precedes Configuration, which precedes Installation, which precedes Runtime, which precedes the library
- **AND** the library precedes the VSCode / Cursor group, which lists Extension, then the MCP server, then the Socket IPC page
- **AND** Chat Renamer lists its configuration page under the overview
- **AND** Development includes a link to Building
- **AND** the page does not link to `/guide/scripts`

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Published asset URLs

**Reason**: The prefix `/variant-worktrees/` ties the build to one deployment path. Relocatable asset URLs replace it.

**Migration**: Use [Relocatable asset URLs](#requirement-relocatable-asset-urls). The GitHub Pages deployment keeps working from the same build.
