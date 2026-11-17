## ADDED Requirements

### Requirement: Repository variants.yaml runs the example

The `variants.yaml` at the repository root SHALL list the `be` and `fe` apps of the example project as watches. Each
watch SHALL receive its own variant port in `PORT` through `env.overrides` with the value `${port}`, and the `fe` watch
SHALL receive the port of the `be` watch of the same variant in `VARIANT_API_PORT` with the value `${be.port}`. The
example `fe` app SHALL define the script `app:watch` and the example `be` app the script `server:watch`; each starts the
app serving on `PORT` and rebuilding when its sources change, and neither app SHALL define the former names `dev` or
`start:dev`. The `fe` watch command SHALL be `bun run app:watch` and the `be` watch command SHALL be `bun run server:watch`,
in the root `variants.yaml` and in `example/variants.yaml`. The root file SHALL validate against the `variants.yaml` schema.

#### Scenario: Ports per watch

- **WHEN** the configuration is loaded from the repository root
- **THEN** the watches `be` and `fe` both set `PORT` to `${port}`, and `fe` sets `VARIANT_API_PORT` to `${be.port}`

#### Scenario: Watch commands

- **WHEN** the configuration is loaded from the repository root, and from `example/`
- **THEN** in both the `fe` watch runs `bun run app:watch` and the `be` watch runs `bun run server:watch`

#### Scenario: Scripts renamed

- **WHEN** the `package.json` of `example/fe` and `example/be` are read
- **THEN** `example/fe` defines `app:watch` and no `dev`, and `example/be` defines `server:watch`, containing `--no-clear-screen`, and no `start:dev`

#### Scenario: Two variants side by side

- **WHEN** two variants of the repository run their watches at once
- **THEN** each `fe` listens on the port of its own variant and proxies `/api` to the `be` of that variant
