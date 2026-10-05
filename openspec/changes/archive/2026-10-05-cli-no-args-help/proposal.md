## Why

Running `variant` without arguments currently does not provide the CLI discovery experience users expect. Treating no arguments as help makes the command safe and self-documenting for first-time users and scripts that probe CLI availability.

## What Changes

- Make `variant` with no arguments produce the same command help as `variant --help`.
- Preserve existing subcommand routing and explicit `--help` behavior.
- Do not execute a lifecycle operation or require database configuration when no command is supplied.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-api/commands`: define no-argument CLI invocation as equivalent to `--help`.

## Impact

- Affects the `variant-api` CLI entry point and its CLI tests.
- Changes only top-level invocation behavior; existing commands, arguments, and output remain unchanged.
