## MODIFIED Requirements

### Requirement: Variant environment variables documented

The repository README and the configuration guide of the documentation site SHALL describe the `VARIANT_*` environment variables as a mapping between each variable and the `variants.yaml` setting or template placeholder it corresponds to, and say which direction it works in: read as an override (`VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`, `VARIANT_<KEY>_PID`, `VARIANT_OPEN`, `VARIANT_ENV_SOURCE`, `VARIANT_STEP_<NAME>`) or set for the commands a variant runs (`VARIANT_SLUG`, `VARIANT_TARGET`, `VARIANT_CONFIG`, `VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`). The description SHALL state how `<KEY>` and `<NAME>` are derived: letters uppercased and every other character replaced by `_`.

#### Scenario: Every variable has a row

- **WHEN** the README and `docs/guide/configuration.md` are read
- **THEN** each of them names `VARIANT_SLUG`, `VARIANT_TARGET`, `VARIANT_CONFIG`, `VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`, `VARIANT_<KEY>_PID`, `VARIANT_OPEN`, `VARIANT_ENV_SOURCE` and `VARIANT_STEP_<NAME>`

#### Scenario: Mapping to settings

- **WHEN** the mapping is read
- **THEN** `VARIANT_SLUG` is tied to `{{slug}}`, `VARIANT_TARGET` to `{{schema}}`, `VARIANT_<KEY>_PORT` to `{{<key>.port}}` and `runtime.watches.<key>.port`, `VARIANT_OPEN` to `variant.open`, `VARIANT_ENV_SOURCE` to `env.sourceFile` and `VARIANT_STEP_<NAME>` to the step `name`

## ADDED Requirements

### Requirement: Configuration examples match the schema

Every `yaml` code block in the repository README, the `variant-vscode` package README and the guides under `docs/` that shows a `variants.yaml` (a top-level `db`, `variant`, `variants` or `chatRenamer` key) SHALL load against the current schema without errors and without warnings. In them `up`, `watch` and `seed` SHALL appear only where the schema defines them: `up` and `watch` inside an entry of `variant.watches`, `seed` as `variant.seed` or `variants.<slug>.seed`. `up` and `watch` SHALL NOT appear directly below the top level or below `variant`. A watch SHALL omit `dir` in the "Describe your project once" example, because its directory defaults to its key. A repository test SHALL fail when such a block does not load or warns.

#### Scenario: Examples load cleanly

- **WHEN** the `yaml` blocks of the READMEs and the guides that show a `variants.yaml` are loaded
- **THEN** none of them fails validation and none of them yields a warning

#### Scenario: Describe your project once

- **WHEN** the "Describe your project once" example is read
- **THEN** it keys its entries under `variant.watches`, and `up`, `watch` and `seed` appear only where the schema defines them
- **AND** its watches rely on the default `dir`
