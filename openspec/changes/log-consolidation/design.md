## Context

See proposal.md for why. `LogEvent` and `setLogSink` live in `variant-api`. The CLI, MCP, and the editor attach sinks. `variant-ipc` has no logger and must not depend on `variant-api`. Messages such as `[create] + mise install` and `[demo] [provision] create schema app` hide the step, and sometimes the slug, inside the string. `renderVersion` always appends the cursive drawing.

## Goals / Non-Goals

**Goals:**

- One event bus that `variant-api`, `variant-ipc`, and `variant-mcp` can emit on.
- `step` and `slug` are fields. The message is the remainder.
- ANSI color only in the CLI renderer.

**Non-Goals:**

- A second logger for chat-renamer.
- Parsing `[step]` out of the message at render time.
- Color in the MCP notification or the editor channel.

## Decisions

**`variant-log` owns the bus.** The package has no dependency on `variant-api`, `variant-config`, or a host SDK. It exports the event, `log`, `logT`, `logD`, `logI`, `logW`, `logE`, and `setLogSink`. `log(level, message, fields?)` takes `{ slug?, step? }`. The shorthands take `(message, fields?)`. No sink drops the event and writes nothing. `variant-api` re-exports those names so existing imports keep working. `variant-ipc` and `variant-mcp` import `variant-log` directly. Alternative: leave the bus in `variant-api`. Rejected: the socket package must not depend on the lifecycle library, and MCP has its own events. Alternative: `util-log`. Rejected: the package is part of this product and follows the `variant-*` names.

**Call sites pass `step`.** A message that starts with `[step]`, or with `[slug] [step]`, loses those brackets. The tokens move to the fields. `announceMise` becomes step `create` (or the action), message `+ mise install`, slug unchanged. Provision and deprovision use the operation name as the step (`provision`, `seed`, `deprovision`) and the variant as `slug`. List, contact, statement, and branch lines have no step. Alternative: keep the brackets and also set `step`. Rejected: two copies of the same token drift.

**The CLI is the only colorer.** `attachLogLevel` reads `event.step`. It does not scan the message. A `warn` event prints `warn`, not `warning`. `--log-level=warning` still selects that level. Color when `stderr.isTTY` and `NO_COLOR` is `undefined` (`""` counts as set). Sequences stay those in [specs/variant-cli/logging](specs/variant-cli/logging/spec.md). The slug is not printed. The editor's `formatVariantLog` reads `step` and `slug` and keeps its current channel text (`<slug> [step] cmd="..."`). MCP notification `data` is an object `{ message, step?, slug? }`, plus `level: "trace"` when the library level is trace. Alternative: color inside `variant-log`. Rejected: the editor channel and MCP would inherit terminal codes.

**IPC emits beside the socket reply.** Invalid JSON and an invalid request emit `warn` with step `request` and the same message the socket returns. A live socket emits `error` with step `listen` and the path, then still throws and leaves the socket. A successful request emits nothing. A handler failure is not logged again here. Alternative: log every request. Rejected: the reply is already the result.

**Banner and color stay separate inputs.** `renderVersion` takes `banner` as well as `color`. `banner` false omits the drawing and the blank line. The CLI passes `banner: stdout.isTTY === true` and the existing `versionColor` result.

## Risks / Trade-offs

- [A script matches `^warning:` or `^debug:` for a log line] → Library lines now start with `[warn]` and `[debug]`. Config `warning:` lines still match. README, the guide, and the changelog say so.
- [MCP clients read `data` as a string] → `data` becomes an object with `message`. Trace still carries `level: "trace"`.
- [The editor formatter still parses brackets] → It reads the fields. The channel text stays the same shape.
- [Piped `--version` loses the drawing] → Spawned CLI tests assert the two-line form. `renderVersion` with `banner` true covers the drawing.

## Migration Plan

No data migration. Build `variant-log` before the packages that depend on it. Rollback is reverting the package, the call sites, and the CLI renderer.
