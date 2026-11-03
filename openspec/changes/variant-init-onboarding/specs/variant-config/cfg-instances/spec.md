## ADDED Requirements

### Requirement: Watch without a kind

The system SHALL accept an entry of `variant.watches` without `kind`. Such a watch SHALL be supervised by `variant
watch` like any other with the `watch` command it sets, and carries no autodetected command, URL or readiness path.
A `kind` that is present SHALL still be `vite` or `nestjs`.

#### Scenario: Plain watch accepted

- **WHEN** `variant.watches` is `{ api: { watch: "npm run watch" } }`
- **THEN** loading succeeds and the resolved watch has no `kind`

#### Scenario: Unknown kind refused

- **WHEN** a watch sets `kind: rails`
- **THEN** loading the configuration fails validation
