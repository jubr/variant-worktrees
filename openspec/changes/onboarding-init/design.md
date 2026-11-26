## Context

See proposal.md for the four symptoms. Where each comes from:

- `renderInitConfig` (`variant-config`) always builds `{ db, variant }`, with `db.dialect` defaulting to `sqlite`. It builds the YAML document from scratch and never calls `schemaHeaderFor`, which only the migration (`addSchemaHeader`) uses.
- `augmentMiseConfig` (`variant-api`) has one constant, `MISE_TOOL`, used for the entry line, the "already listed" check and the messages.
- `createVariantClient` reads the configuration once. `loadVariantClient` (`variant-vscode`) caches one client per `cwd` and `miseBinPath` for the life of the window, and the view, the panel and the three actions share it. The watches in the screenshot's log (`nothing was started`) are the client's `config.variant.watches` of the file as it was before init wrote it.

## Goals / Non-Goals

**Goals:**
- A file written by `init` is final: no migration, no backup, no message on the next command.
- An edit of `variants.yaml` reaches the next editor action.

**Non-Goals:**
- Reloading the configuration in a client that is already subscribed (the tree's live records keep their client; the next refresh of the view is the editor's existing behavior).
- Reporting a watch that started nothing as a failure in the editor; the library already logs the warning.
- Changing the migration's wording or rules for files written by older versions. A header-only migration of such a file keeps today's message.

## Decisions

1. **No `db` when nothing is detected.** `renderInitConfig` builds `db` only when `detectedConnection.source` is `"env"` (a database setting was found), not `"default"`. `detected.dialect` stays `sqlite` in the result, so the CLI line `detected: database sqlite` is unchanged. Alternative: keep `db.dialect: sqlite` and drop only `filename` (today's behavior). Rejected: it pins a default, and the user asked for no `db.` entries.
2. **Header from the existing function.** `renderInitConfig` prepends `schemaHeaderFor("variants.yaml")` and a blank line to the document text, so the text is identical to what `addSchemaHeader` would have produced and the migration finds nothing to do. The "Written by" comment stays below the blank line. Alternative: have `initProject` call `addSchemaHeader` after rendering. Rejected: `renderInitConfig` is the pure renderer that the docs and tests read; the header belongs to its text.
3. **`packslip:` entry, `latest`.** `MISE_TOOL` becomes `packslip:jubr/variant-worktrees`; a second constant lists the tools that count as listed (`packslip:` and `github:`). `lists()` checks both, so the order of checks is unchanged and an existing project is never given a second entry. Version `latest` is kept, as for the former entry: the installation page also installs the latest release. Alternative: pin the running version (`0.0.13`). Rejected: the CLI, the extension and the MCP server version independently and a pin goes stale on the next release; this is the same reason the entry used `latest`.
4. **Cache key carries the file's signature.** `loadVariantClient` builds its key from `cwd`, `miseBinPath` and a signature of the configuration file found for `cwd` (`findConfigFile`): its path, `mtimeMs` and size, or `none` when there is no file. A changed signature makes a new client; the old client is dropped from the map and keeps working for whoever still holds it (the subscription). Alternatives: (a) a new client for every action, rejected because a client also owns the state subscriptions and loading the config shells out to Mise on every press; (b) a file watcher that clears the cache, rejected because it needs a second watcher beside the library's and a press right after a save could still race it. The signature is a `stat` per call.
5. **Docs show the real output.** `docs/guide/installation.md` and the `variant init` section of `docs/guide/commands.md` show the header line, the `packslip:` mise line, and an example without a `db` key where the detected database is none. README's init paragraph names the `packslip:` entry.

## Risks / Trade-offs

- [A project that has `github:jubr/variant-worktrees` gets no `packslip:` entry] → intended: the check treats both as listed; no mise file is rewritten.
- [Without a `db` key a later change of the autodetected default changes this project's database] → the default has been SQLite since the config's introduction and is specified in `variant-config/core`; a project that wants to pin it writes `db.dialect`.
- [A `stat` of the configuration file per action] → negligible against the action itself (a database round-trip and a process start).
- [The signature does not notice a change of `mise.local.toml`, which also feeds the configuration] → out of scope; reloading the window stays the way for environment changes.
- [`mtimeMs` equal on a fast double edit with the same size] → a same-size edit within the clock resolution is accepted as unchanged; the next change is read.
