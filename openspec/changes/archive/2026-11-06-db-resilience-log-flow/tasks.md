## 1. Library log stream

- [x] 1.1 Add failing tests for [specs/variant-api/logging | Log levels](../../specs/variant-api/logging/spec.md#requirement-log-levels): events at `trace`, `debug`, `info`, `warn`, and `error` reach an attached sink, and logging with no sink does not throw or write standard output. Verify `bun test` on that new file fails first.
- [x] 1.2 Implement the logger in `variant-api` and export it. Verify the tests from 1.1 pass.

## 2. Unreachable database

- [x] 2.1 Add failing tests for [specs/variant-api/logging | Database contact warning](../../specs/variant-api/logging/spec.md#requirement-database-contact-warning) and [specs/variant-api/logging | Statement at debug only](../../specs/variant-api/logging/spec.md#requirement-statement-at-debug-only): refused connection, timeout, unknown host, authentication failure, and a missing database name emit one warning that names dialect, database, host, and port and contains no password and no `SELECT`; a URL password is absent; a missing SQLite file does not warn; a statement from a `Failed query` wrapper is only on a debug event. Verify the new tests fail first.
- [x] 2.2 Classify those driver causes in the PostgreSQL and MySQL adapters, build the warning from the configured target, and log the statement at debug. Verify the tests from 2.1 pass.
- [x] 2.3 Add failing tests for [specs/variant-api/core | List while the database cannot be contacted](../../specs/variant-api/core/spec.md#requirement-list-while-the-database-cannot-be-contacted), [specs/variant-api/core | Mutations fail closed when the database cannot be contacted](../../specs/variant-api/core/spec.md#requirement-mutations-fail-closed-when-the-database-cannot-be-contacted), [specs/variant-api/core | Other database failures hide the statement](../../specs/variant-api/core/spec.md#requirement-other-database-failures-hide-the-statement), and [specs/variant-api/status | Status while the database cannot be contacted](../../specs/variant-api/status/spec.md#requirement-status-while-the-database-cannot-be-contacted). Cover `demo` listed and `orphan` omitted, an empty list, `create` exiting non-zero with the contact warning and no `SELECT`, a non-contact failure whose stderr has no `Failed query`, `status demo` succeeding, and `status ghost` failing with the contact warning. Verify they fail first.
- [x] 2.4 Make `list` and `status` follow those tests, and fail schema create, drop, and migrate with the contact warning. Verify the tests from 2.3 pass.
- [x] 2.5 Add failing tests in `packages/variant-api/test/subscribe.test.ts` for [specs/variant-api/state-watch | Subscription failure and teardown](../../specs/variant-api/state-watch/spec.md#requirement-subscription-failure-and-teardown): an unreachable database delivers `demo`, no `orphan`, no error, and the contact warning, then clears the warning and includes `orphan` when contact returns; another read failure still keeps the last set. Verify they fail first.
- [x] 2.6 Carry the contact warning on the subscription delivery without setting the read error. Verify the tests from 2.5 pass and the existing unsubscribe and shared-watcher tests still pass.

## 3. CLI log level

- [x] 3.1 Add failing tests in `packages/variant-cli/test/` for [specs/variant-cli/logging | Log level flag](../../specs/variant-cli/logging/spec.md#requirement-log-level-flag) and [specs/variant-cli/logging | Verbose is not a log level](../../specs/variant-cli/logging/spec.md#requirement-verbose-is-not-a-log-level): default `variant list` prints `warning:` on stderr and not on stdout; `--log-level=error` hides it and still exits 0; `--log-level=trace` prints `trace:`; `--log-level=debug` before the command name selects debug; `--log-level=warning` selects warn; `--log-level=loud` exits non-zero, names the flag and the allowed values, and does not run the command; `variant list -v` stays the verbose listing and does not print `debug:` because of `-v`. Verify they fail first.
- [x] 3.2 Parse `--log-level` as a global flag, filter the library stream, and write the prefixed lines to stderr. Verify the tests from 3.1 pass.
- [x] 3.3 Update the completions test so `--log-level` is offered the way `--json` is. Verify `bun test packages/variant-cli/test/completions-scripts.test.ts` passes.

## 4. MCP log stream

- [x] 4.1 Add failing tests in `packages/variant-mcp/test/mcp.test.ts` for [specs/variant-mcp/logging | Logging notifications](../../specs/variant-mcp/logging/spec.md#requirement-logging-notifications) and [specs/variant-mcp/logging | Tool results and a contact failure](../../specs/variant-mcp/logging/spec.md#requirement-tool-results-and-a-contact-failure): default threshold sends warning and not info; `logging/setLevel` `info` sends info and warning and not debug; `debug` sends trace as a debug notification whose data names trace; `error` drops the warning; `variant_list` is not a tool error and its text has no `SELECT`; `variant_create` is a tool error whose text is the contact warning and has no `SELECT`. Verify they fail first.
- [x] 4.2 Attach the library stream to MCP logging notifications and map levels as the spec says. Verify the tests from 4.1 pass.

## 5. Editor tree, notification, and channel

- [x] 5.1 Add failing tests in `packages/variant-vscode/src/variants-tree.spec.ts` and `packages/variant-vscode/src/variants-view.spec.ts` for [specs/variant-vscode/variants-tree | Unreachable database in the trees](../../specs/variant-vscode/variants-tree/spec.md#requirement-unreachable-database-in-the-trees) and [specs/variant-vscode/variants-tree | One warning notification](../../specs/variant-vscode/variants-tree/spec.md#requirement-one-warning-notification): both views show `Database unreachable` first, then `main` and `demo`, with description `app` and `127.0.0.1` and a tooltip without `SELECT`; the row leaves when contact returns; one warning notification appears for three refreshes of one outage; a later outage notifies once more. Verify they fail first.
- [x] 5.2 Add a failing test for [specs/variant-vscode/variants-tree | Library logs on the Variant Worktrees channel](../../specs/variant-vscode/variants-tree/spec.md#requirement-library-logs-on-the-variant-worktrees-channel): the contact warning is written to the existing **Variant Worktrees** channel as a warning, and no second channel is created. Verify it fails first.
- [x] 5.3 Show the warning row from the subscription warning, notify on the transition into unreachable, and forward library events to the existing channel. Verify the tests from 5.1 and 5.2 pass.

## 6. Docs and gates

- [x] 6.1 Document `--log-level` and the contact warning in the repository README CLI section and in `docs/guide/core.md`, and add an Unreleased entry to the root `CHANGELOG.md`. Verify `task docs:build` passes.
- [x] 6.2 Run `task lint`, `task test`, `task build`, and `openspec validate --all --strict --no-interactive`. Verify each passes.
