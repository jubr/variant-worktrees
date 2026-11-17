## Why

The repository's own `variants.yaml` exercises the example project, but it only half-uses the placeholders: `be` gets
`${port}` and `fe` does not, so `fe` listens on its default port while its URL names another, and `fe` cannot reach
the `be` of the same variant. The two example apps also name their watch scripts differently (`dev`, `start:dev`), which
says little about what a watch does.

## What Changes

- `variants.yaml` at the repository root, committed for the first time, gives its watches `example-be` and `example-fe` each their variant port through `env.overrides` (`PORT`
  from `${port}`), and `example-fe` points its API proxy at the variant's `example-be` through `${example-be.port}`.
- The example `fe` script `dev` is renamed to `app:watch` and the example `be` script `start:dev` to `server:watch`.
  Their commands do not change: each already builds on the fly and rebuilds on change. Every reference is updated: both
  `variants.yaml` files that run them, the example README and the example test.
- The `ready` paths of both root watches are set so `variant watch` reports them up once they serve.

Non-goals: the container (`up`) setup stays as it is; no new `variants.yaml` option; the autodetection of `dev` and
`start:dev` scripts in other projects stays.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-config/core`: adds a requirement for the repository's own `variants.yaml` and the example's watch scripts
  (ports per watch, script names). The existing "Example project" requirement is unchanged.

## Impact

- `variants.yaml` (repository root), `example/variants.yaml`, `example/fe/package.json`, `example/be/package.json`,
  `example/README.md`, `packages/variant-config/src/example-project.spec.ts`, `CHANGELOG.md`.
- Anyone running `bun run dev` or `bun run start:dev` inside `example/` uses the new names.
- No library, CLI or schema change.
