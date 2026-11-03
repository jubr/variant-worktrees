## ADDED Requirements

### Requirement: Mise executable setting

The system SHALL accept `variant.mise.binPath`, a non-empty string, in `variants.yaml`. Its meaning is specified in
[specs/tools/mise | Mise executable resolution](../../tools/mise/spec.md#requirement-mise-executable-resolution).

#### Scenario: Accepted

- **WHEN** `variants.yaml` sets `variant.mise.binPath: /opt/homebrew/bin/mise`
- **THEN** loading succeeds and the resolved configuration carries that path

#### Scenario: Empty refused

- **WHEN** `variants.yaml` sets `variant.mise.binPath: ""`
- **THEN** loading the configuration fails validation
