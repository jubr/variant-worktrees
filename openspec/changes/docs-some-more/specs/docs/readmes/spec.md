## MODIFIED Requirements

### Requirement: Configuration examples match the schema

Every `yaml` code block in the repository README, the `variant-vscode` package README and the guides under `docs/` that shows a `variants.yaml` (a top-level `db`, `variant` or `chatRenamer` key) SHALL load against the current schema without errors and without warnings. In them `up`, `watch` and `seed` SHALL appear only where the schema defines them: `up` and `watch` inside an entry of `variant.watches`, `seed` as `variant.seed`. `up` and `watch` SHALL NOT appear directly below the top level or below `variant`. A repository test SHALL fail when such a block does not load or warns.

#### Scenario: Examples load cleanly

- **WHEN** the `yaml` blocks of the READMEs and the guides that show a `variants.yaml` are loaded
- **THEN** none of them fails validation and none of them yields a warning

#### Scenario: Describe your project once

- **WHEN** the "Describe your project once" example is read
- **THEN** it keys its entries under `variant.watches`, and `up`, `watch` and `seed` appear only where the schema defines them
