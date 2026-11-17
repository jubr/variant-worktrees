## ADDED Requirements

### Requirement: Repository variants.yaml runs the example

The `variants.yaml` at the repository root SHALL be committed and SHALL list the `be` and `fe` apps of the example
project as the watches `example-be` and `example-fe`. Each watch SHALL receive its own variant port in `PORT` through `env.overrides` with the value `${port}`, and `example-fe`
SHALL receive the port of `example-be` of the same variant in `VARIANT_API_PORT` with the value `${example-be.port}`. The
example `fe` app SHALL define the script `app:watch` and the example `be` app the script `server:watch`; each starts the
app serving on `PORT` and rebuilding when its sources change, and neither app SHALL define the former names `dev` or
`start:dev`. In the root `variants.yaml`, `example-fe` SHALL run `bun run app:watch` and `example-be` SHALL run `bun run server:watch`;
the `fe` and `be` watches of `example/variants.yaml` SHALL run the same commands. The root file SHALL validate against the `variants.yaml` schema.

#### Scenario: Ports per watch

- **WHEN** the configuration is loaded from the repository root
- **THEN** the watches `example-be` and `example-fe` both set `PORT` to `${port}`, and `example-fe` sets `VARIANT_API_PORT` to `${example-be.port}`

#### Scenario: Watch commands

- **WHEN** the configuration is loaded from the repository root, and from `example/`
- **THEN** the frontend watch (`example-fe`, or `fe` in `example/`) runs `bun run app:watch` and the backend watch (`example-be`, or `be`) runs `bun run server:watch`

#### Scenario: Scripts renamed

- **WHEN** the `package.json` of `example/fe` and `example/be` are read
- **THEN** `example/fe` defines `app:watch` and no `dev`, and `example/be` defines `server:watch`, containing `--no-clear-screen`, and no `start:dev`

#### Scenario: Two variants side by side

- **WHEN** two variants of the repository run their watches at once
- **THEN** each frontend watch listens on the port of its own variant and proxies `/api` to the backend watch of that variant
