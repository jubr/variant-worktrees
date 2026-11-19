## Why

Core lists `init` under *Other commands*, though it is the first command a new project runs. And `variant.seed` is a second spelling of what the `seed` step already does, so the docs and the schema describe one thing twice.

## What Changes

- **`init` first.** In the Core guide, `init` becomes the first heading of *Lifecycle commands*, before `create`. *Other commands* starts with `config`. The `core#init` deep link stays valid.
- **BREAKING: `variant.seed` is removed.** The schema, the loader, provisioning, the schema file, the example, the READMEs and the guides drop it. A seed is the step named `seed` (`variant.steps.seed.cmd`). A leftover `variant.seed` loads like any unknown key: one warning names it.

## Capabilities

### New Capabilities

### Modified Capabilities

- `docs/site`: Core lists `init` first under *Lifecycle commands*; the Overview no longer links to `variant.seed`.
- `docs/readmes`: `seed` in configuration examples is a step.
- `variant-config/core`: the `variant.seed` requirement is removed; the `config` origin-comment scenario uses `variant.baseBranch`.
- `variant-api/provisioning`: provisioning order ends with the steps.

## Impact

- `packages/variant-config` (`schema.ts`, generated `variants.yaml.schema.json`, `variants.example.yaml`), `packages/variant-api/src/provisioning.ts`, and the specs of those packages and of `variant-cli`, `variant-mcp`.
- `example/variants.yaml` moves its seed into a `seed` step.
- `README.md`, `packages/variant-vscode/README.md`, `AGENTS.md`, `docs/guide/{core,configuration,overview,library,runtime}.md`, `docs/mcp.md`, and `scripts/docs-site.spec.ts`.
