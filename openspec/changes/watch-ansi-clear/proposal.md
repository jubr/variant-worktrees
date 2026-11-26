## Why

A `tty` watch gives its process a terminal, so tools such as Vite print clear-screen sequences (erase display, cursor home, full reset) on every rebuild. In `.cache/variant/watch.log` and in the attached `watch` output those bytes are noise: a pager or `tail -f` of the log wipes or jumps the viewport, and a reader or agent that cats the log gets control codes where the history should be. Color is useful there; clearing the screen is not.

## What Changes

- **Clear-screen sequences are stripped from watch output.** Every line a watch process writes, before it is prefixed, loses these ANSI sequences: erase in display (`ESC [ J`, with any parameter, including `2J` and `3J`), cursor home (`ESC [ H`, `ESC [ ; H`, `ESC [ 1 ; 1 H`) and full terminal reset (`ESC c`). Both the standard output of an attached watch and `.cache/variant/watch.log` receive the stripped line.
- **Color and other sequences stay.** SGR color sequences and the reset appended to a `tty` line that contains an escape are untouched, as is every other escape sequence.
- **A line that held only clear codes is not written.** The prefix alone (`[fe] `) would be an empty noise line.
- **Applies to every output mode.** A `no-tty` process can print the same bytes; the strip does not depend on the mode.

## Capabilities

### New Capabilities

### Modified Capabilities

- `variant-api/runtime`: the watch output log and the `tty` terminal transcript no longer contain clear-screen ANSI sequences.

## Impact

- `packages/variant-api/src/watch-relay.ts` (the relayed lines) and its sibling spec; the detached relay and the extension's bundled `watch-relay.js` share that code.
- `docs/guide/commands.md` and `docs/guide/configuration.md` (the `output.mode` text), `README.md` watch paragraph, and `CHANGELOG.md`.
- No change to CLI flags, MCP tools, configuration keys or the `[watch] ... mode=tty` line.

## Non-goals

- A setting to keep the clear codes.
- Stripping color or any other escape sequence, or interpreting cursor movement.
- Changing what the watch process itself sees: only the relayed copy changes.
