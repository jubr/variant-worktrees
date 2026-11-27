## ADDED Requirements

### Requirement: Branch builds report the slim runtime and executable sizes

After the compile and smoke test of `variant` for linux-x64, the CI workflow SHALL write a Markdown table to the step summary of that job. The table SHALL name the `bun-slim` release the executable embeds (`bun-slim-vX.Y.Z-N`), and give, in KB (1 KB = 1024 bytes), the size of that slim runtime and the size of the compiled `variant`. The report SHALL NOT fail the job: when the release or a size cannot be determined, the table SHALL show `–` for it. The report SHALL NOT download anything.

#### Scenario: Table on a green run

- **WHEN** the CI workflow compiles `variant` for linux-x64 with the slim runtime `bun-slim-v1.4.5-1`
- **THEN** the step summary has a table with `bun-slim-v1.4.5-1`, the size of the slim runtime in KB and the size of `variant` in KB

#### Scenario: Release unknown

- **WHEN** the slim runtime is not in the cache directory of the job
- **THEN** the table shows `–` for the release and the runtime size, and still gives the size of `variant`
- **AND** the job does not fail because of the report
