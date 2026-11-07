## Context

See proposal.md for why. Library events stay `{ level, message, slug? }`. The CLI prints them from `attachLogLevel` as `warning: message` and drops the slug. Many messages already start with `[step]`, and some start with `[slug] [step]`. `renderVersion` always appends the cursive drawing; `versionColor` only decides orange versus plain. Progress lines (`logToStderr`, the watch callback, the implode report) are not library events. Config and migration warnings are separate `warning:` writes.

## Goals / Non-Goals

**Goals:**

- One CLI renderer for the log line and its color, gated on standard error.
- Banner presence gated on standard output, separate from orange.
- Shorthands that call `log` and nothing else.

**Non-Goals:**

- A `step` field on the event. The CLI reads a leading `[step]` from the message.
- Coloring progress lines, config warnings, or the editor log channel.

## Decisions

**Render in the CLI, not the library.** `attachLogLevel` formats the line. Hosts that are not the CLI keep the raw message. Alternative: color inside `log`. Rejected: the editor and MCP would inherit terminal codes, and the spec colors only the CLI.

**The first leading `[token]` is the step.** A message matching `^\[([^\]]+)\]` contributes that token, brackets removed, as the step. One leading space is stripped from the remainder. Anything else, including a second `[token]`, stays in the message. No match means there is no step. Alternative: treat `[slug] [name]` as slug plus step. Rejected: the slug is not always the separate field, and the message text is not rewritten. Alternative: add `step` to the event. Rejected: every call site would change shape for a display rule.

**Color uses the same gate as the banner, on stderr.** Color when `stderr.isTTY` and `NO_COLOR` is `undefined` (`""` counts as set, matching `versionColor`). Sequences are the ones in [specs/variant-cli/logging](specs/variant-cli/logging/spec.md): dark gray `90` brackets, trace `38;5;67`, debug `33`, info `32`, warning `38;5;208`, error `31`, step `36`, reset `0` after `]` and after the step. `208` is the orange already used for the drawing. Alternative: one color for every level. Rejected: the level word is the part that has to differ.

**Banner and color are separate inputs.** `renderVersion` takes `banner` as well as `color`. `banner` false omits the drawing and the blank line after it, so the details line is next. `color` true is only meaningful when `banner` is true. The CLI passes `banner: stdout.isTTY === true` and the existing `versionColor` result. Alternative: omit the drawing whenever color is off. Rejected: a terminal with `NO_COLOR` still prints the glyphs.

**Shorthands are wrappers.** `logT`, `logD`, `logI`, `logW`, and `logE` call `log` with `trace`, `debug`, `info`, `warn`, and `error`. They are exported next to `log`. Literal calls, including `emit("debug", ...)` and `logEvent("info", ...)`, switch to the wrapper. A call whose level is not a literal stays on `log`. Progress callbacks that are typed as `(line: string) => void` are not that function and stay.

## Risks / Trade-offs

- [A script matches `^warning:` for the contact warning] → The contact line now starts with `[warning]`. Config and migration `warning:` lines still match. README, the guide, and the changelog say so.
- [`[slug] [provision] ...` paints the slug cyan] → Accepted. The second bracket stays in the message. Message strings are not edited to move the slug.
- [Piped `--version` loses the drawing] → Tests that spawn the CLI assert the two-line form. The drawing stays covered by `renderVersion` with `banner` true.

## Migration Plan

No data migration. Rollback is reverting the CLI renderer, the version flag, and the wrappers. Events on the wire are unchanged.
