## ADDED Requirements

### Requirement: Variant environment variables documented

The repository README and the configuration guide of the documentation site SHALL describe the `VARIANT_*` environment variables as a mapping between each variable and the `variants.yaml` setting or template placeholder it corresponds to, and say which direction it works in: read as an override (`VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`, `VARIANT_<KEY>_PID`, `VARIANT_OPEN`, `VARIANT_ENV_SOURCE`, `VARIANT_STEP_<NAME>`) or set for the commands a variant runs (`VARIANT_SLUG`, `VARIANT_TARGET`, `VARIANT_CONFIG`, `VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`). The description SHALL state how `<KEY>` and `<NAME>` are derived: letters uppercased and every other character replaced by `_`.

#### Scenario: Every variable has a row

- **WHEN** the README and `docs/guide/configuration.md` are read
- **THEN** each of them names `VARIANT_SLUG`, `VARIANT_TARGET`, `VARIANT_CONFIG`, `VARIANT_<KEY>_PORT`, `VARIANT_<KEY>_URL`, `VARIANT_<KEY>_PID`, `VARIANT_OPEN`, `VARIANT_ENV_SOURCE` and `VARIANT_STEP_<NAME>`

#### Scenario: Mapping to settings

- **WHEN** the mapping is read
- **THEN** `VARIANT_SLUG` is tied to `{{slug}}`, `VARIANT_TARGET` to `{{schema}}`, `VARIANT_<KEY>_PORT` to `{{<key>.port}}` and `runtime.instances.<key>.port`, `VARIANT_OPEN` to `variant.open`, `VARIANT_ENV_SOURCE` to `env.sourceFile` and `VARIANT_STEP_<NAME>` to the step `name`
