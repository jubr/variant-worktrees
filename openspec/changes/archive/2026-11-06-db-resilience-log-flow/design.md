## Context

See proposal.md for why. `list` asks the database adapter for schema names and lets the driver error propagate. That error's message is `Failed query:` plus the SQL, which the CLI prints on stderr and which the Variants tree shows as its only row when the subscription reports a failed read. `-v` / `--verbose` is already the richer command result (full provisioning output, and `list` printed like `status`). The editor already has one **Variant Worktrees** log channel. Chat-renamer logging is a separate stream and stays as it is.

## Goals / Non-Goals

**Goals:**

- Classify "cannot contact the configured database" once, and keep that class out of user-visible SQL.
- Let reads finish from state files and worktrees, and fail commands that must change a schema.
- One library log stream, three sinks: CLI stderr, MCP logging notifications, the existing editor channel.

**Non-Goals:**

- A shared package with the chat-renamer logger.
- Teaching the MCP protocol a `trace` level it does not have.
- Changing the `list` JSON array to carry warnings.

## Decisions

**Logger in `variant-api`, sink supplied by the host.** The library emits `trace` / `debug` / `info` / `warn` / `error` and does not import the editor or the MCP SDK. The CLI, the MCP server, and the extension each attach a sink. No sink means the event is dropped. Alternative: depend on `chat-renamer-api`'s logger. Rejected: `variant-api` must not depend on the renamer. Alternative: a new logging package. Rejected: one interface does not justify a package.

**Contact failures are classified from the driver cause, not from the `Failed query` wrapper.** Refused connection, timeout, unknown host, authentication failure, and "database does not exist" are contact failures. A statement error after a live connection is not. PostgreSQL and MySQL take this path. SQLite inventory is the `.db` files on disk; a missing file is not a contact failure. The user-facing sentence names dialect, database, host, and port, and never a password or the SQL. The statement, when there is one, is a debug event. Alternative: string-match `Failed query` and continue. Rejected: that wrapper is also used for real statement errors, which must still fail the command.

**Reads degrade; mutations fail closed.** `list`, `status` of a slug known from a state file or worktree, and the subscription return those records and one contact warning. Schema-only variants are absent until contact works. `create` and anything else that creates, drops, or migrates a schema fail with that same sentence and a non-zero exit. The warning is not a field of the `list` JSON array. The subscription delivery carries it beside the records so the tree does not have to parse log lines. Alternative: keep the previous catalog so schema-only rows do not disappear. Rejected: those rows would be stale with no way to know they still exist.

**CLI threshold is `--log-level`, default `warn`.** Parsed as a global flag the same way `--json` is, before or after the command name. `warning` is accepted as `warn`. Lines go to stderr with a level prefix (`warning:`, `error:`, `info:`, `debug:`, `trace:`) so stdout stays the command result. `-v` is not reused. Alternative: `-v` / `-vv` as log verbosity. Rejected: `-v` is already `--verbose` on every command.

**MCP uses the SDK's logging levels.** `warn` is sent as `warning`. `trace` is sent as `debug`, with the library level named in the notification data, and only after the client sets `debug`, because this SDK's levels have no `trace`. Until `logging/setLevel`, the server sends warning and error. Tool results are unchanged JSON; a contact failure on a read is not a tool error. A mutation's tool error text is the contact sentence.

**Editor: one channel, one notification, one warning row.** Library events are forwarded to the existing **Variant Worktrees** log channel at the matching level; the channel's own level picker filters them. The tree provider adds a `Database unreachable` row above the variants in both views and does not switch the store to the error state that replaces the list. `showWarningMessage` runs on the transition into unreachable, not on every refresh.

## Risks / Trade-offs

- [Schema-only variants vanish while the database is down] → The warning row and the notification say contact failed, so the absence is explained. They return on the next successful read.
- [A contact class that is too wide hides a real fault] → Only the cause codes named above degrade the read. Every other database failure still fails the command, with the statement at debug.
- [A driver message echoes the connection URL] → The user-facing sentence is built from dialect, database, host, and port. The driver text is not the warning.
- [MCP `debug` includes trace] → The notification data names the library level. The CLI and the editor still have a separate trace level.
- [An outage that flaps notifies on every recovery] → That is one notification per loss of contact, which is the signal asked for. Steady unreachability does not repeat.

## Migration Plan

No data migration and no config key. Rollback is reverting the change: reads throw on contact failure again, and the log flags disappear. Ship the library, CLI, MCP server, and extension together so a warning the library emits has a sink in each host.

## Open Questions

None. The log flag and the unreachable-read behavior are decided above.
