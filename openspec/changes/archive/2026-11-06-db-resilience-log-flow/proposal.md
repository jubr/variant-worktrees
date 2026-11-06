## Why

`variant list` dies when the configured database cannot be contacted, and the only text a person sees is the driver's `Failed query:` line with the SQL. The Explorer **Variant Worktrees** section then replaces its rows with that same text. There is also no one stream of trace, debug, info, warning, and error messages that the CLI, the MCP server, and the editor logs all show.

## What Changes

- A configured database that cannot be contacted no longer fails a read. `list`, `status` of a variant known from its state file or worktree, and the variant subscription still return those records. Variants that exist only as database schemas are omitted until contact works. The failure is a warning that names the dialect and the target and contains neither a password nor the SQL.
- A command that must change the database still fails, with that same sentence and a non-zero exit, not with the SQL.
- Any other database failure still fails the command. The text a person sees has no SQL statement; the statement is logged at debug.
- The editor shows one non-modal warning notification when contact is lost, and both **Variant Worktrees** trees keep their variant rows and add a warning row at the top. The notification is not repeated while the database stays unreachable. When contact returns, the row goes away.
- The library emits one log stream at `trace`, `debug`, `info`, `warn`, and `error`. The CLI prints it on stderr. The default threshold is `warn`, so the contact warning shows with no flag. `--log-level=trace|debug|info|warn|error` (and `warning` as a name for `warn`) sets the threshold, before or after the command name. `-v` / `--verbose` stays the richer command output it is today; it is not a log level and there is no `-vv`.
- The MCP server sends the same events as logging notifications and honors the client's logging level. A read tool stays successful; a mutation that cannot contact the database is an error whose text is the contact sentence.
- The VS Code extension writes the same events to the existing **Variant Worktrees** log channel, which the editor filters by its own level.

## Capabilities

### New Capabilities

- `variant-api/logging`: the leveled log stream and the database-contact warning, including what a person is allowed to see at warning and error.
- `variant-cli/logging`: `--log-level` on the `variant` CLI, stderr lines, and the unchanged meaning of `-v`.
- `variant-mcp/logging`: MCP logging notifications for that same stream, and how a tool result treats a contact failure.

### Modified Capabilities

- `variant-api/core`: `list` succeeds when the configured database cannot be contacted, returning records known from state files and worktrees.
- `variant-api/status`: `status` of a variant known without the database succeeds; a slug that cannot be resolved because the database is unreachable fails with the contact sentence.
- `variant-api/state-watch`: an unreachable database is not a failed read. The subscriber gets the partial records and no error, then a new set when contact returns.
- `variant-vscode/variants-tree`: both trees show a database warning row above the variants and the editor shows one warning notification, without replacing the variant rows. Library log events go to the existing Variant Worktrees log channel.

## Impact

- `variant-api` (database adapters, `list` / `status` / subscription, a logger hosts can attach), `variant-cli` (stderr log lines and `--log-level`), `variant-mcp` (logging capability), `variant-vscode` (warning row, one notification, library logs on the existing channel).
- README, `docs/guide/core.md`, and the changelog, for `--log-level` and the contact warning.
- Shell completions gain `--log-level` because they already complete the flags the CLI accepts.

## Non-goals

- Changing what `-v` / `--verbose` does, or adding `-vv`.
- A second editor log channel, or any change to chat-renamer log lines.
- Retries, a reconnect loop, or a background health probe.
- A new field on the `list` JSON array. The warning stays on the log stream and on stderr.
- Treating a missing SQLite file as an unreachable database. SQLite inventory is the files already on disk.
