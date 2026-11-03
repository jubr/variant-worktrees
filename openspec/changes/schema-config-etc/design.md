## Context

- Every schema in `variant-config` is a Zod `strictObject`, and `readConfigFile` calls `VariantsConfigSchema.parse`, so one unknown key throws. `variants.yaml.schema.json` is generated from the same schemas for editors.
- `instances` is the record of `variant.instances`, of `runtime.instances` in `variants.local.yaml`, of the `instances` field of records and reports, and of the reserved `variant-ui` entry that `variant ui` writes into the runtime state of `main`.
- `openspec validate` matches the scenarios of a MODIFIED requirement by title against the current spec, so the deltas keep existing scenario titles that contain the old word, and headers are renamed with RENAMED.
- The workflows use `@v4`/`@v2` pins that run on Node 20; newer majors of each action run on Node 24 (or are composite).

## Goals / Non-Goals

**Goals:**
- One rule for warnings: unknown keys only. One place that implements it.
- A rename that leaves no `instance` of this meaning in code, tests, docs, specs text and JSON output.
- Release and packaging tasks that need no manual follow-up.

**Non-Goals:**
- Warnings for other violations, a `--strict` switch, or lenient `variants.local.yaml`.
- Renaming spec directories or the chat renamer's editor-window "instance".
- Aliasing `variant.instances` in `variants.yaml`.

## Decisions

### Strict schemas stay; a parse wrapper turns unknown keys into warnings

`parseConfig(schema, data)` safe-parses with the strict schema. When every issue is `unrecognized_keys`, it deletes those keys at their paths from a copy of the data, records a warning per key (`<file>: unknown key <path>`), and parses again; any other issue throws the `ZodError` as today, with the warnings attached to the message when both occur. Rejected alternative: switching to non-strict objects, which would drop the strict JSON schema that editors use to flag typos, and would need a second pass anyway to find the ignored keys. The loop runs at most once per nesting depth because deletion removes exactly the reported keys.

`loadConfig` returns `warnings: string[]` on `ResolvedConfig`. The CLI prints each as `warning: <message>` on stderr once per process, before the command output; `variant config` and the MCP `variant_config` result carry the array in their JSON. The lightweight `chatRenamer` reader ignores warnings.

### `variants.local.yaml` stays strict, with a legacy read of `instances`

The file is written by the tool, so an unknown key means a version mismatch, and silently dropping state would hide that. Because the rename would otherwise make every running variant's old file invalid, `readRuntime` renames a `runtime.instances` record to `watches` before validation when `watches` is absent; writes always use `watches`. No other compatibility exists: `variant.instances` in `variants.yaml` is an unknown key and warns, and the watch it described is then autodetected or absent. That is acceptable for 0.0.x, as in earlier breaking config changes, and is called out in the changelog.

### Rename by role, mechanically, then by review

Identifiers `instance`/`instances`/`Instance*` become `watch`/`watches`/`Watch*` (`VariantInstance` → `VariantWatch`, `InstanceFacts` → `WatchFacts`, `UI_INSTANCE_KEY` → `UI_WATCH_KEY`, `detectInstances` → `detectWatches`). A scripted pass covers the repeatable cases; the diff is then read for sentences that become awkward ("a watch's `watch` command") and for words that must stay (`instanceof`, `toBeInstanceOf`, VS Code `ThemableDecorationInstanceRenderOptions`, chat renamer window instances, file names `ui-instance.ts` and spec directories). The `watch` command inside a watch stays `watch`; `kind`, `up`, `container` stay.

### `dir` default

`dir` becomes optional in the watch schema and is resolved to the key when absent, in the loader that already applies defaults, so consumers still see a string. Autodetected watches keep their explicit `dir`, including `.` for the configuration directory.

### Example check as a test

A spec in `variant-config/test` reads the fenced `yaml` blocks of `README.md`, `packages/variant-vscode/README.md` and `docs/**/*.md` that start with a top-level `db`, `variant`, `variants` or `chatRenamer` key and loads each through `parseConfig`; it asserts no error and no warning. This keeps docs from drifting again and is the evidence for "up, watch and seed only where defined". Placeholder-only snippets (a bare `variant:` fragment with `...`) are skipped by the top-level key rule only when they do not parse as YAML objects; fragments must be valid as written.

### Release changelog

`promoteUnreleased` locates the `Unreleased` section if present, takes its body, and replaces the section by the version section. Without a section it inserts the version section before the first `## ` heading (after the preamble), or at the end when there is none. The heading regex still accepts `## Unreleased` and `## [Unreleased]`. The answer to "must it be added later": yes, by whoever records the next change; `CONTRIBUTING.md` says so in its changelog and release notes. The release no longer needs it, so a missing heading is not an error. The current files keep their empty heading until the next release removes it.

### Node 24 actions

Pins move to `actions/checkout@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `jdx/mise-action@v5`, `actions/upload-pages-artifact@v5` (composite), `actions/deploy-pages@v5`, and the commented `azure/login@v3` line is updated with them. `oven-sh/setup-bun@v2` already runs on Node 24. A test parses `uses:` lines and compares the major against a table of minimums; comments are skipped. Rejected: environment variable `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`, which only hides the annotation while the pins stay outdated.

### Unpacked extension in main

`requireVariantWorktree` stops refusing the main checkout; the destination is still the main checkout's `out/variant-worktrees-main`, resolved by `detectVariantMain(cwd)`, so main publishes into itself. The `--check` flag and the Taskfile precondition go away, because nothing remains to check; the task description changes from "Variant worktree only". The `AIDEV-NOTE` in the script is kept untouched and a new note beside it records the new rule.

## Risks / Trade-offs

- A typo in an optional key (`variant.reservedPort`) now warns instead of failing, so a user who ignores stderr runs with the default. Mitigation: the warning names the key path; MCP and `variant config` expose the array.
- The breaking rename makes an old `variants.yaml` with `variant.instances` fall back to autodetection with a warning. Mitigation: changelog entry and the warning text; no alias.
- A wide mechanical rename can alter unrelated words. Mitigation: review the diff by file group, keep the protected-word list above, run the full gate.
- Newer action majors can change inputs. Mitigation: the branch workflow itself runs on the feature branch before merge; the pages and publish workflows use the same major for the same action.
