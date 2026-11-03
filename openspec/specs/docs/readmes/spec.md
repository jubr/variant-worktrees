# docs/readmes Specification

## Purpose

The repository README and the `variant-worktrees` extension README introduce the product story-first, link to the online documentation, and carry the extension description shown on the marketplaces.

## Requirements

### Requirement: Extension description

The `variant-vscode` manifest `description` SHALL be `Isolated work+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode`.

#### Scenario: Marketplace tagline

- **WHEN** the `variant-vscode` `package.json` is read
- **THEN** its `description` is `Isolated work+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode`

### Requirement: README tagline

Each of the two READMEs SHALL show the extension description as its tagline, in the lines before the first second-level heading.

#### Scenario: Tagline in both READMEs

- **WHEN** either README is read
- **THEN** the extension description appears before the first second-level heading

### Requirement: Documentation link first

The repository README and the `variant-vscode` package README SHALL each link to the online documentation at `https://jubr.github.io/variant-worktrees/` before any other prose section. The link SHALL be an absolute URL so it works on the extension marketplaces.

#### Scenario: Both READMEs open with the documentation link

- **WHEN** either README is read
- **THEN** the first link to `https://jubr.github.io/variant-worktrees/` appears before the first second-level heading

### Requirement: Story-first README

Each of the two READMEs SHALL tell why before how: the first second-level section SHALL explain the problem that variants solve, and a later section SHALL show how a variant is created, watched, and imploded with `variant create`, `variant watch`, and `variant implode`.

#### Scenario: Why precedes how

- **WHEN** either README is read
- **THEN** the first second-level heading is named `Why`
- **AND** the text `variant watch` first appears after that heading
- **AND** `variant implode` appears in the README

### Requirement: Extension README is user-facing

The `variant-vscode` package README SHALL NOT contain development information: no `bun install`, `bun run`, `bun test`, `task `, `F5`, or `Extension Development Host`, and no Development heading. It SHALL describe the CLI, `variants.yaml` configuration, the MCP server, and the chat renamer.

#### Scenario: No development information

- **WHEN** the `variant-vscode` package README is read
- **THEN** it contains none of `bun install`, `bun run`, `bun test`, `F5`, or `Extension Development Host`
- **AND** it has no heading named Development

#### Scenario: Product areas present

- **WHEN** the `variant-vscode` package README is read
- **THEN** it mentions `variants.yaml`, `variant-mcp`, and `/chat-rename`

### Requirement: Repository README content

The repository README SHALL show the product, say how to install the CLI with `mise use github:jubr/variant-worktrees`, describe the human and agent workflow, and keep its `variants.yaml` configuration, CLI, MCP, and chat renamer sections. Its CLI section SHALL show every `variant` command and SHALL list the global flags (`--json`, `--yaml`) in a "Global flags" subsection apart from the per-command flags. Contributor workflow SHALL be limited to a pointer to `CONTRIBUTING.md`.

#### Scenario: Install and contributor pointer

- **WHEN** the repository README is read
- **THEN** it contains `mise use github:jubr/variant-worktrees`
- **AND** it links to `CONTRIBUTING.md`
- **AND** it contains no `task lint` command

#### Scenario: Every command shown

- **WHEN** the CLI section of the repository README is read
- **THEN** it shows `variant status` and every other command the CLI lists

#### Scenario: Global flags apart

- **WHEN** the CLI section of the repository README is read
- **THEN** a "Global flags" subsection lists `--json` and `--yaml`
- **AND** the per-command flags are not listed in that subsection

### Requirement: Variant environment variables documented

The repository README and the configuration guide of the documentation site SHALL describe the `VARIANT_*` environment variables as a mapping between each variable and the `variants.yaml` setting or template placeholder it corresponds to, and say which direction it works in: read as an override (`VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`, `VARIANT_<KEY>_PID`, `VARIANT_OPEN`, `VARIANT_MIGRATE`, `VARIANT_ENV_SOURCE`, `VARIANT_STEP_<NAME>`) or set for the commands a variant runs (`VARIANT_SLUG`, `VARIANT_TARGET`, `VARIANT_CONFIG`, `VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`). The description SHALL state how `<KEY>` and `<NAME>` are derived: letters uppercased and every other character replaced by `_`.

#### Scenario: Every variable has a row

- **WHEN** the README and `docs/guide/configuration.md` are read
- **THEN** each of them names `VARIANT_SLUG`, `VARIANT_TARGET`, `VARIANT_CONFIG`, `VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`, `VARIANT_<KEY>_PID`, `VARIANT_OPEN`, `VARIANT_MIGRATE`, `VARIANT_ENV_SOURCE` and `VARIANT_STEP_<NAME>`

#### Scenario: Mapping to settings

- **WHEN** the mapping is read
- **THEN** `VARIANT_SLUG` is tied to `${slug}`, `VARIANT_TARGET` to `${schema}`, `VARIANT_<KEY>_PORT` to `${<key>.port}` and `runtime.watches.<key>.port`, `VARIANT_OPEN` to `variant.open`, `VARIANT_MIGRATE` to the rewrite of migrated configuration files (`0` turns it off), `VARIANT_ENV_SOURCE` to `env.sourceFile` and `VARIANT_STEP_<NAME>` to the step `name`

### Requirement: Extension README has no relative images

The `variant-vscode` package README SHALL NOT embed an image by a repository-relative path, because the extension pages of the marketplaces do not resolve it and render a broken image. The extension icon stays the manifest `icon`.

#### Scenario: No relative image

- **WHEN** the `variant-vscode` package README is read
- **THEN** it contains no markdown image whose target is not an absolute `https://` URL

### Requirement: Configuration examples match the schema

Every `yaml` code block in the repository README, the `variant-vscode` package README and the guides under `docs/` that shows a `variants.yaml` (a top-level `db`, `variant`, `variants` or `chatRenamer` key) SHALL load against the current schema without errors and without warnings. In them `up`, `watch` and `seed` SHALL appear only where the schema defines them: `up` and `watch` inside an entry of `variant.watches`, `seed` as `variant.seed` or `variants.<slug>.seed`. `up` and `watch` SHALL NOT appear directly below the top level or below `variant`. A repository test SHALL fail when such a block does not load or warns.

#### Scenario: Examples load cleanly

- **WHEN** the `yaml` blocks of the READMEs and the guides that show a `variants.yaml` are loaded
- **THEN** none of them fails validation and none of them yields a warning

#### Scenario: Describe your project once

- **WHEN** the "Describe your project once" example is read
- **THEN** it keys its entries under `variant.watches`, and `up`, `watch` and `seed` appear only where the schema defines them
