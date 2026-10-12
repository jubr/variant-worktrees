## Context

The CLI currently delegates top-level argument handling to its command router. The change is limited to `variant-api`; lifecycle commands and their generated routing remain unchanged. See `proposal.md` for motivation and the delta spec for the required behavior.

## Goals / Non-Goals

**Goals:**

- Normalize an empty top-level argument list to the existing help path.
- Ensure help rendering happens before client creation or command execution.
- Add regression coverage comparing no-argument output with explicit help output.

**Non-Goals:**

- Changing command names, flags, positional argument parsing, or help text.
- Changing library, MCP, or VS Code behavior.

## Decisions

- Reuse the CLI library's existing help behavior by supplying the equivalent help input for an empty argument list. This avoids duplicating help formatting and keeps future command additions reflected automatically.
- Test both exit status and help content, while ensuring no database-backed lifecycle operation is invoked. A custom help renderer is rejected because it could drift from explicit `--help`.
- Keep the change at the CLI entry point rather than altering shared command definitions, since no-argument handling is top-level invocation semantics.

## Risks / Trade-offs

- [Risk] CLI library internals may distinguish an omitted argument list from explicit help → Mitigation: run focused subprocess tests for both invocations and validate matching help output.
- [Risk] Refactoring argument normalization could affect command dispatch → Mitigation: retain the existing command smoke sequence and run package checks.

## Migration Plan

No data or configuration migration. Release the CLI change with normal package deployment. Rollback by reverting the CLI entry-point change; existing explicit help and subcommands remain available.
