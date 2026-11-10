## Context

See [proposal.md](proposal.md) for why. Today `variant-log` exports `LOG_LEVELS` as a readonly array and `LogLevel` as that array's element type. `variant-api` re-exports both. Call sites pass string levels into `log`, `logT`, `logD`, `logI`, `logW`, and `logE`. The CLI ranks those strings for stderr. The editor socket keeps a second handwritten set of the same five words.

Command lines take two shapes. Mise logs a message `+ mise trust --all` (plus, space, no quotes). Seed and step commands log the raw command. `formatVariantLog` rewrites a message that starts with `+ ` into `cmd="..."`. `extension.ts` then appends ` [${origin}]`. The progress callback in `echo.ts` prints `+ <command>` on its own stream and is specified separately.

`list` logs `list`, `listing variants`, and `listed variants` unless `quiet` is set. Subscriptions pass `quiet` after the first read only to skip those lines.

Implode's branch and finish lines call `logD` with no slug. The CLI fills a missing slug with the working directory, so `variant implode -s release-smoke` from the primary checkout shows `<main>` on those lines and on `ipc` / `cli end`. Lines that already pass `slug: run.slug` (schema create, seed) show the named variant.

Awake kill is `awake.trace`. A title-event decision uses info for every reason except `before startup`, `no first prompt`, and `too old`.

## Goals / Non-Goals

**Goals:**

- One downgrade point for the temporary-directory rule, and one quote helper for shell-command messages.
- One enum as the source of the five level words, imported by the CLI and the socket.
- The named slug on the implode events themselves, plus CLI fill-in for events the CLI emits with no slug.

**Non-Goals:**

- Do not change `echoCommand` or the progress-log line `+ <command>`.
- Do not change the awake start message (`+ "caffeinate …"` with a space, pid, and reason). Its level is debug.
- Do not remove the `quiet` option on `list`. It stops affecting logs because those logs are gone.
- Do not demote CLI `ipc` and `cli` events when the working directory is a known temporary directory. The temporary-directory rule covers library events.

## Decisions

### String enum, array derived from it

`LogLevel` becomes a TypeScript string enum with members `trace`, `debug`, `info`, `warn`, `error`. `LOG_LEVELS` is those members in that order, built from the enum, and stays the value CLI validation and the socket set iterate. `variant-api` keeps re-exporting both. The socket deletes its local set and uses `LOG_LEVELS`.

A string enum is not assignable from a bare string literal. `log`, the rank table, and tests that pass `"info"` move to enum members. `logI` and the other shorthands stay the call-site API and pass the member themselves.

Alternative: keep the readonly array. Rejected: the request is an enum. Alternative: a const object plus a string union, so literals still typecheck. Rejected: that is the current type under another name. The wire words stay the member values, so stderr, MCP, and the socket do not gain a new spelling. `--log-level=warning` stays a CLI alias outside the enum.

### Downgrade at emit, using a directory argument

A helper next to the library log wrappers takes the level and the directory the rule selects. When the directory matches, the emitted level is `trace`. Call sites that already know the directory pass it: provisioning and seed (`run.projectDir`), mise (the worktree), implode (the variant project directory), and the contact/statement logger (the process working directory, because those events have no slug).

The known list is `/tmp`, `/private/tmp`, `/var/folders`, `/var/tmp`, and the process temporary directory. A path matches when it is equal to an entry or nested under it. The check resolves symbolic links on the entry and on the directory, and also accepts the unresolved prefix, so a macOS `/tmp` → `/private/tmp` link covers both spellings. A directory that cannot be resolved is compared as given.

Alternative: raise the sink threshold to `error` inside tests. Rejected: the call site would still emit info, and the editor channel would still show it. Alternative: demote only info. Rejected: the request forces the level to trace so tests are as quiet as possible, including warn and error.

### Command text is the message

`commandMessage(command)` returns `+` plus `JSON.stringify(command)`, which is `+"printf seeded"` and escapes quotes and backslashes. Seed, shell steps, and both mise lines use it. `create schema …` stays a plain sentence. `formatVariantLog` stops rewriting `+ ` into `cmd=` and prints the message. The channel suffix becomes ` @` plus the origin, in the one place that appends `[${origin}]` today.

Alternative: quote only in the formatter and leave the message as `+ cmd`. Rejected: stderr prints the message, and the seed message is not prefixed today, so the two hosts would still disagree unless both rewrite.

### Slug on the event, and CLI fill-in for the rest

Implode passes the variant slug on the finish event and the branch event. The CLI, once arguments are parsed, passes an explicit `-s` / `--slug` into the sink. The sink uses that value only when the event has no slug, so a schema line that already carries `release-smoke` stays, and a bare event during `variant implode -s release-smoke` from `main` takes `release-smoke` too. Steps `ipc` and `cli` stay on stderr and are not sent. With no explicit slug, working-directory detection stays, including `main`.

Alternative: change only the CLI fill-in and leave implode's `logD` calls slug-less. Rejected: the extension logs implode in-process and would still show the checkout slug.

### Decision and kill levels stay local

`logDecision` sends `rename request` through the debug writer. The info fallback remains for `current title shares the base`, `no rename request`, and `malformed request`. Awake changes the start and kill calls from `trace` to `debug`. The start message stays `+ "caffeinate …"` with a space. Both live in the shared renamer packages; `variant-vscode` does not grow a copy.

## Risks / Trade-offs

- [Tests under a known temporary directory assert info, debug, or warn] → Those events are trace. A fixture that needs the call site's level uses a directory outside that list. The contact-warning and implode scenarios that require warn or debug say the directory is not temporary.
- [String enum rejects string literals] → Typecheck is the sweep. Shorthand `logI` / `logD` / `logT` / `logW` / `logE` keeps most call sites off the enum name.
- [`/tmp` vs `/private/tmp`] → Match both the given prefix and the resolved path. `/var/folders`, `/var/tmp`, and the process temporary directory match the same way. A directory outside that list stays at the call site's level.
- [Readers match `cmd=` or ` [cli]`] → The line format is a break. README, `docs/guide/core.md`, and `CHANGELOG.md` move with the code. No socket field is renamed.
- [Demoted warn and error hide a real failure in the editor channel during a run under a known temporary directory] → Accepted. The message is still emitted at trace. A checkout outside that list is unchanged.

## Migration Plan

No data migration and no flag change. Ship the enum, the emit helper, the message helper, the channel suffix, and the slug fill-in together so tests and docs describe one line shape. Rollback is reverting that change. Parsers that matched `cmd="…"` or ` [cli]` / ` [mcp]` follow the new spellings `+"…"` and ` @cli` / ` @mcp`.
