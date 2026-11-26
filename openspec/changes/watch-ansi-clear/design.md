## Context

See proposal.md - Why. Watch output goes through one function in `watch-relay.ts` (`relay`): it buffers raw chunks, splits on `\n`, adds the `[key] ` prefix (and the reset for `tty` lines that hold an escape) and writes the line to the console sink and the log. The same path serves attached watches, the detached relay child and the extension's bundle, for pipes and for every terminal allocator.

## Goals / Non-Goals

**Goals:**
- One place removes the sequences, so every allocator and every sink agree.
- Sequences that the process emits in the same line as real text (Vite writes them directly before its message, without a newline) leave that text intact.

**Non-Goals:**
- A general ANSI parser. Only the sequences named in the spec are removed.

## Decisions

- **Strip per complete line, in `relay`'s emit step, before the reset check.** Lines are already the unit of buffering, and a clear sequence never needs to span a newline, so no stateful cross-chunk matching is needed; a sequence split over two chunks is rejoined by the existing buffer. Alternative: strip per raw chunk - rejected, a sequence split at a chunk boundary would survive.
- **Strip before `closeAnsi`.** A line whose only escapes were clear codes then holds no escape and gets no reset sequence appended.
- **One regular expression.** `ESC [ <digits and ;>* J`, `ESC [ <digits and ;>* H`, and `ESC c`. The `H` form covers `ESC [ H`, `ESC [ ; H` and `ESC [ 1 ; 1 H`; any row/column is accepted because a program that homes to another position is repainting, not logging. `ESC [ ? ... J` (selective erase) is not matched. Alternative: also strip `ESC [ 2K` and cursor-up - rejected, they are line-level repaint and out of the request.
- **Drop a line that was non-empty and became empty.** An originally empty line stays (blank lines in output are meaningful); only a line emptied by the strip is skipped. A bare `\r` handling stays as today.
- **No mode condition.** Pipes and terminals share the relay, and the cost of matching a missing escape is one `includes` check on the line.

## Risks / Trade-offs

- [A tool repaints with `ESC [ H` plus line overwrites, so stripped logs show every frame one after another] → That is the intent: the log is a history, not a screen.
- [A line emptied by the strip hides a heartbeat, such as a process that clears and prints nothing] → The log keeps nothing wrong; nothing was said.
- [Regex on every line costs time on chatty watches] → Guard with `includes("\u001b")` first.
