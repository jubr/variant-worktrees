## ADDED Requirements

### Requirement: README links are absolute and verified

Every link in `README.md`, the `variant-vscode` README and the `chat-renamer-vscode` README SHALL be an absolute URL (`https://…`), because those files are shown on GitHub, npm and the marketplace, where relative links break. A link to the documentation site SHALL name a page and, when it has a fragment, a heading that exists in the built site. A link to a file or directory of the repository SHALL be an absolute link to `https://github.com/jubr/variant-worktrees`. A script SHALL rewrite relative links to absolute ones, and a repository test SHALL fail for a relative link or a documentation link that does not resolve. The READMEs SHALL NOT name configuration keys or shapes of earlier versions, and no more than the documentation says.

#### Scenario: No relative link

- **WHEN** the links of the three READMEs are listed
- **THEN** each starts with `https://`, and none starts with `./`, `../` or `/`

#### Scenario: Documentation links resolve

- **WHEN** each link to `https://jubr.github.io/variant-worktrees/` in the three READMEs is mapped onto the built site
- **THEN** its page exists and its fragment, if any, is an `id` of that page

#### Scenario: Mise is the way to install

- **WHEN** the three READMEs are searched
- **THEN** none contains `npm install`, `npx` or `bun add`

#### Scenario: Earlier names are not mentioned

- **WHEN** the three READMEs are searched
- **THEN** none contains `variant.instances`, `reservedPorts`, `variants.local.yaml` or `.cache/variants/`

## MODIFIED Requirements

### Requirement: Configuration examples match the schema

Every `yaml` code block in the repository README, the `variant-vscode` package README and the guides under `docs/` that shows a `variants.yaml` (a top-level `db`, `variant` or `chatRenamer` key) SHALL load against the current schema without errors and without warnings. In them `up`, `watch` and `seed` SHALL appear only where the schema defines them: `up` and `watch` inside an entry of `variant.watches`, `seed` as `variant.seed`. `up` and `watch` SHALL NOT appear directly below the top level or below `variant`. A repository test SHALL fail when such a block does not load or warns.

#### Scenario: Examples load cleanly

- **WHEN** the `yaml` blocks of the READMEs and the guides that show a `variants.yaml` are loaded
- **THEN** none of them fails validation and none of them yields a warning

#### Scenario: Describe your project once

- **WHEN** the "Describe your project once" example is read
- **THEN** it keys its entries under `variant.watches`, and `up`, `watch` and `seed` appear only where the schema defines them
