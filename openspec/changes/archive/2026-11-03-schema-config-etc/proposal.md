## Why

Mistakes in `variants.yaml` that do no harm (a leftover or misspelled key) stop every command today, while the real problems (a wrong type, a missing value) need that strictness. The configuration also names its running processes `instances` although a user thinks of them as what `variant watch` supervises, and it makes every entry repeat a `dir` that is nearly always its own name, and it reserves a list of well-known ports instead of picking from a range of its own. The README example does not show the current shape, CI runs print Node.js 20 deprecation warnings, a release leaves an empty `Unreleased` heading in every changelog, and the task that unpacks the extension for local loading refuses to run in the main checkout.

## What Changes

- **Extra properties warn.** A key that the schema does not define in `variants.yaml` is ignored and reported as a warning that names the file and the key path. Every other violation stays an error: wrong types, out-of-range values, missing required keys, cross-field rules (duplicate step names, reserved watch keys, colliding environment segments). Warnings are part of the resolved configuration and the CLI prints them to standard error. `variants.local.yaml`, which the tool writes, stays strict. The JSON schema files keep rejecting unknown keys for editors.
- **BREAKING: `instances` become `watches`.** `variant.instances` is `variant.watches`; `runtime.instances` in `variants.local.yaml` is `runtime.watches`; the `instances` fields of records, status, `list` and `watch`/`up` reports, MCP results, the HTTP API and the UI model are `watches`; the reserved `variant-ui` instance of `main` is a watch; types, functions, tests, docs, the example project and the CLI text follow. `VARIANT_<KEY>_*` variables, `{{<key>.port}}` placeholders and container names are unchanged because they carry the key, not the word.
- **Older files keep working and are migrated.** Loading reads `variant.instances`, `runtime.instances` and `variant.reservedPorts` under the current names, in memory, with a notice. The `variant` CLI and the VS Code extension then best-effort rewrite the file: `variants.yaml` only when git tracks it and it has no uncommitted changes, the git-ignored `variants.local.yaml` unconditionally; never when `CI` is set or `VARIANT_MIGRATE=0`. The CLI prints what changed and how to review and revert it with git; the extension shows a persistent notification with an **Open file** button. The library, MCP server and `variant ui` never write.
- **`dir` defaults to the key** of a watch (`fe` gets `fe`); an explicit `dir` stays valid, and the docs and the example keep showing it.
- **BREAKING: `variant.ports.range`** (default `42000-42999`) replaces `variant.reservedPorts`: free ports for watches and the `variant ui` server are picked from the range, and no port is reserved. An explicit port (`VARIANT_<KEY>_PORT`, the runtime state, `variant.ui.port`) is kept wherever it lies.
- **Docs follow the schema.** The README, the extension README and the guides show the current configuration; `up` and `watch` appear only inside a watch, `seed` only as `variant.seed` or `variants.<slug>.seed`. A test loads every such example and fails on an error or a warning.
- **CI runs on Node 24 actions.** `actions/checkout`, `upload-artifact`, `download-artifact`, `jdx/mise-action`, `oven-sh/setup-bun`, `upload-pages-artifact` and `deploy-pages` move to majors that run on Node.js 24, which removes the annotations a run shows now.
- **Release removes `Unreleased`.** `task release:changelog` replaces the `Unreleased` section (bracketed or not) by the new version section and no longer fails when there is none. The next contributor who records a change adds `## Unreleased` again.
- **`task package:vsix:unpacked` also runs in the main checkout** and unpacks into that checkout's own `out/variant-worktrees-main`.

## Capabilities

### New Capabilities

- `variant-cli/config-migration`: when and how the CLI rewrites a migrated configuration and what it prints.
- `variant-vscode/config-migration`: the extension's rewrite and its persistent notification with **Open file**.

### Modified Capabilities

- `variant-config/core`: legacy names are read under the current names with notices and a text-rewrite function; extra properties warn; warnings in the resolved configuration; watch discovery, URL and env under the new name; runtime state `watches` with legacy read; seed, env and chat renamer unknown keys warn.
- `variant-config/cfg-instances`: `variant.watches`, default `dir`, watch options and container, former and extra keys warn.
- `variant-config/cfg-settings`: new `variant.ports.range`, former keys warn. `variant-config/cfg-provisioning`: former keys warn. `variant-config/cfg-runtime`: watch port resolution picks from the range; the reserved-ports requirement is removed.
- `variant-api/core`, `variant-api/runtime`, `variant-api/provisioning`, `variant-api/status`, `variant-api/commands`, `variant-api/implode`, `variant-api/node-runtime`, `variant-api/output-formats`, `variant-api/state-watch`: `watches` in records, state and reports.
- `variant-mcp/tools`, `variant-server/ui-instance` (also: port from the range), `variant-ui/variants-view`, `variant-vscode/variants-tree`: `watches` in results, the UI server watch, rows and items.
- `docs/readmes`: configuration examples match the schema (new requirement) and the mapping names `runtime.watches`.
- `meta/release-artifacts`: changelog release removes `Unreleased`; the unpacked extension task runs in the main checkout.
- `meta/ci-feature-builds`: workflow actions run on Node 24.

## Impact

- `packages/variant-config` (schema, lenient parse with warnings, loader, legacy migration, ports, local state, autodetect, JSON schemas, example yaml), `variant-api` (types, operations, runtime state), `variant-cli` (warning and migration output, text), `variant-mcp`, `variant-server`, `variant-ui`, `variant-vscode` (migration notification).
- `example/variants.yaml`, `README.md`, `packages/variant-vscode/README.md`, `docs/`, `CHANGELOG.md`, `CONTRIBUTING.md`.
- `.github/workflows/*.y*ml`, `scripts/release-changelog.ts`, `scripts/package-vsix-unpacked.ts`.
- Non-goals: a test that pins action versions; an alias that keeps `instances` as a documented name; renaming spec capability directories (`cfg-instances`, `ui-instance`); the word "instance" for editor windows in the chat renamer; changing which `variants.yaml` values are valid; making `variants.local.yaml` lenient.
