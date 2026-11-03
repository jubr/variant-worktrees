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
- Keeping `instances` or `reservedPorts` as documented names: they are only read for migration.
- Rewriting files from the library, the MCP server or `variant ui`.
- A test that pins action versions.

## Decisions

### Strict schemas stay; a parse wrapper turns unknown keys into warnings

`parseConfig(schema, data)` safe-parses with the strict schema. When every issue is `unrecognized_keys`, it deletes those keys at their paths from a copy of the data, records a warning per key (`<file>: unknown key <path>`), and parses again; any other issue throws the `ZodError` as today, with the warnings attached to the message when both occur. Rejected alternative: switching to non-strict objects, which would drop the strict JSON schema that editors use to flag typos, and would need a second pass anyway to find the ignored keys. The loop runs at most once per nesting depth because deletion removes exactly the reported keys.

`loadConfig` returns `warnings: string[]` on `ResolvedConfig`. The CLI prints each as `warning: <message>` on stderr once per process, before the command output; `variant config` and the MCP `variant_config` result carry the array in their JSON. The lightweight `chatRenamer` reader ignores warnings.

### `variants.local.yaml` stays strict

The file is written by the tool, so an unknown key means a version mismatch, and silently dropping state would hide that. Its only tolerated difference is the legacy `instances` record described next.

### Legacy names: read in memory, rewrite only in the CLI and the extension

`variant-config` gets one `migrateLegacy(data, file)` that renames `variant.instances` → `variant.watches` and `runtime.instances` → `runtime.watches`, drops `variant.reservedPorts`, and returns the migrated data plus notices. `readConfigFile` and `readRuntime` call it before validation, so an old file loads without an unknown-key warning and `ResolvedConfig` carries `migrations`. A second function `migrateText(text)` applies the same edits to the YAML text through the `yaml` library's document API (`parseDocument`), which keeps comments, order and layout, and returns nothing when no edit applies. Neither function touches the file system, so library users, the MCP server and `variant ui` never write.

A small module `migrateFile(path, env)` in `variant-config` does the guarded write and is called only by the CLI and the extension:

1. Skip with a reason when `CI` is set to something other than empty, `0` or `false`, or `VARIANT_MIGRATE=0`.
2. `variants.yaml`: skip when `git status --porcelain -- <file>` is not empty for a tracked file (the rewrite must be exactly revertible with `git checkout -- <file>`). When `git ls-files --error-unmatch` does not list it (or there is no repository), git cannot revert the rewrite, so the old text is first written byte for byte to `<file>~` with the exclusive flag; an existing backup skips the rewrite so no earlier backup is lost, and a failed rewrite removes the backup it wrote. Rejected: rewriting dirty tracked files, which could lose the only copy of a hand edit, and rewriting an untracked file without a backup.
3. `variants.local.yaml` is git-ignored and tool-owned (it is rewritten on every runtime write anyway), so the git conditions are skipped for it.
4. Write the new text; on any error return the failure as the reason. Callers never fail because of this.

The result (`rewritten` or `skipped` with a reason, the file, the notices) is what the callers print. The CLI prints it to stderr once per process and file: after a rewrite it says the file is git-tracked and can be reviewed with `git diff` and reverted with `git checkout -- <file>`, or, for an untracked file, that git cannot revert it and where the backup is; when skipped it names the reason and the manual rename. The extension shows `showWarningMessage` with the actions **Open file** and, after a rewrite, **Undo** (writes the old text back, removes the backup the rewrite saved, and leaves a file that changed since alone); a warning notification with an action stays until the user closes it, and it is shown once per file and session. `VARIANT_MIGRATE` is a new variable, documented next to `VARIANT_OPEN`, and the README mapping table and its spec scenario list it.

The migration is a stop gap for 0.0.x files; it can be deleted when no old config is expected.

### Rename by role, mechanically, then by review

Identifiers `instance`/`instances`/`Instance*` become `watch`/`watches`/`Watch*` (`VariantInstance` → `VariantWatch`, `InstanceFacts` → `WatchFacts`, `UI_INSTANCE_KEY` → `UI_WATCH_KEY`, `detectInstances` → `detectWatches`). A scripted pass covers the repeatable cases; the diff is then read for sentences that become awkward ("a watch's `watch` command") and for words that must stay (`instanceof`, `toBeInstanceOf`, VS Code `ThemableDecorationInstanceRenderOptions`, chat renamer window instances, file names `ui-instance.ts` and spec directories). The `watch` command inside a watch stays `watch`; `kind`, `up`, `container` stay.

### `dir` default

`dir` becomes optional in the watch schema and is resolved to the key when absent, in the loader that already applies defaults, so consumers still see a string. Autodetected watches keep their explicit `dir`, including `.` for the configuration directory. An explicit `dir` stays valid and the docs and the example keep showing it, because the explicit form is the clearer one to read.

### Example check as a test

A spec in `variant-config/test` reads the fenced `yaml` blocks of `README.md`, `packages/variant-vscode/README.md` and `docs/**/*.md` that start with a top-level `db`, `variant`, `variants` or `chatRenamer` key and loads each through `parseConfig`; it asserts no error and no warning. This keeps docs from drifting again and is the evidence for "up, watch and seed only where defined". Placeholder-only snippets (a bare `variant:` fragment with `...`) are skipped by the top-level key rule only when they do not parse as YAML objects; fragments must be valid as written.

### Port range

`variant.ports` is a new strict object with `range`, a string validated by `^\d+-\d+$` plus a refinement (both ends 1024 to 65535, low not above high); the loader resolves it to `{ low, high }` with the default `42000-42999`. `pickFreePort` takes the range instead of the reserved list: it tries the ports in order from a random offset, wrapping once, and returns the first that a loopback listen reports free, or throws an error naming the range. The callers (`resolveWatchPort`, `run-context`, the UI server) pass the range; `run-context` still excludes ports it has already assigned to other watches in the same run. Explicit ports skip the range check, as they skipped the reserved check. `reservedPorts`, `DEFAULT_RESERVED_PORTS`, the schema entry and the JSON schema entry are deleted; the legacy migration drops the key. Rejected: random free ports from the OS in a range-limited retry loop, which has no bound when the range is mostly used, and which cannot report exhaustion.

### Release changelog

`promoteUnreleased` locates the `Unreleased` section if present, takes its body, and replaces the section by the version section. Without a section it inserts the version section before the first `## ` heading (after the preamble), or at the end when there is none. The heading regex still accepts `## Unreleased` and `## [Unreleased]`. The answer to "must it be added later": yes, by whoever records the next change; `CONTRIBUTING.md` says so in its changelog and release notes. The release no longer needs it, so a missing heading is not an error. The current files keep their empty heading until the next release removes it.

### Node 24 actions

Pins move to `actions/checkout@v7`, `actions/upload-artifact@v7`, `actions/download-artifact@v8`, `jdx/mise-action@v5`, `actions/upload-pages-artifact@v5` (composite), `actions/deploy-pages@v5`, and the commented `azure/login@v3` line is updated with them. `oven-sh/setup-bun@v2` already runs on Node 24. The verification is the annotation-free run of the feature branch itself; no test pins versions. Rejected: environment variable `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`, which only hides the annotation while the pins stay outdated.

### Unpacked extension in main

`requireVariantWorktree` stops refusing the main checkout; the destination is still the main checkout's `out/variant-worktrees-main`, resolved by `detectVariantMain(cwd)`, so main publishes into itself. The `--check` flag and the Taskfile precondition go away, because nothing remains to check; the task description changes from "Variant worktree only". The `AIDEV-NOTE` in the script is kept untouched and a new note beside it records the new rule.

## Risks / Trade-offs

- A typo in an optional key (`variant.baseBranches` for `variant.branchPrefixes`) now warns instead of failing, so a user who ignores stderr runs with the default. Mitigation: the warning names the key path; MCP and `variant config` expose the array.
- A rewrite changes a file the user owns. Mitigation: only a tracked, clean `variants.yaml` (or an untracked one with a `~` backup), comments and layout preserved, an announcement that names git as the way back, and the opt-outs `CI` and `VARIANT_MIGRATE=0`. A user on an old version of the tool that reads the same file would see `watches` as an unknown key; the pair is rolled out together by one release.
- A narrower default port range (1000 ports) can run out for many variants at once. Mitigation: a clear error naming the range, and `variant.ports.range` can be widened.
- A wide mechanical rename can alter unrelated words. Mitigation: review the diff by file group, keep the protected-word list above, run the full gate.
- Newer action majors can change inputs. Mitigation: the branch workflow itself runs on the feature branch before merge; the pages and publish workflows use the same major for the same action.
