## Why

The repository's own `variants.yaml` exercises the example project, but it only half-uses the placeholders: `be` gets
`${port}` and `fe` does not, so `fe` listens on its default port while its URL names another, and `fe` cannot reach
the `be` of the same variant. Both watches run plain dev commands that neither build first nor share a naming scheme
with each other.

## What Changes

- `variants.yaml` at the repository root gives `be` and `fe` each their variant port through `env.overrides` (`PORT`
  from `${port}`), and `fe` points its API proxy at the variant's `be` through `${be.port}`.
- Both watches run through one named script each: `fe` runs `app:watch`, `be` runs `server:watch`. A script builds
  its app once, then keeps it running and rebuilding on change.
- The example `fe` and `be` packages define those two scripts.
- The `ready` paths of both watches are set so `variant watch` reports them up once they serve.

Non-goals: `example/variants.yaml` and the container (`up`) setup stay as they are; no new `variants.yaml` option.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-config/core`: adds a requirement for the repository's own `variants.yaml` (ports per watch, watch scripts
  that build and then watch). The existing "Example project" requirement is unchanged.

## Impact

- `variants.yaml` (repository root), `example/fe/package.json`, `example/be/package.json`.
- A test that loads the root `variants.yaml`; `example/README.md` and `CHANGELOG.md` mention the new scripts.
- No library, CLI or schema change.
