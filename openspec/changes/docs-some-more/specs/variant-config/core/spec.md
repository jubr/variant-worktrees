## MODIFIED Requirements

### Requirement: Seed command configuration

The system SHALL allow `variants.yaml` to define a seed command for all variants (`variant.seed`). A former top-level `seed` key and a top-level `variants` key SHALL be ignored with a warning, like any unknown key.

#### Scenario: Global seed command
- **WHEN** `variants.yaml` has `variant.seed: "bun run db:seed"`
- **THEN** `variant provision` executes that command with variant environment

#### Scenario: Former top-level seed
- **WHEN** `variants.yaml` has a top-level `seed` key
- **THEN** loading succeeds, the key is ignored and one warning names it

#### Scenario: Per-variant seed override
- **WHEN** `variants.yaml` has `variant.seed: "bun run db:seed"` and a top-level `variants` key with `main.seed: "echo skip"`
- **THEN** loading succeeds and one warning names the `variants` key
- **AND** provisioning slug `main` runs `bun run db:seed`
