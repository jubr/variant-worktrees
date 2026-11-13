## Why

`variant config` prints the resolved configuration, including values the file never set, but every line looks the same. A reader cannot tell whether a value was written in the worktree file, written in the main `variants.yaml`, filled by a built-in default, discovered, or read from the environment. On a terminal the text is also plain, so it is harder to scan than the same document printed by yq.

## What Changes

- The default text of `variant config` remains the full resolved configuration: file values and the detected values (built-in defaults, autodetection, environment).
- Each line that carries a value gets an end-of-line YAML comment naming that origin. A line that only opens a nested mapping does not.
- The comment is one of: the worktree's own configuration file, the main `variants.yaml`, a built-in default, autodetection, or an environment variable (the variable name when one variable supplied the value).
- When stdout is a terminal and `NO_COLOR` is unset, that text uses yq's YAML colors: cyan keys, green strings, bright-magenta numbers and booleans, bright-black comments. Null, `[]`, `{}`, colons, and dashes stay uncolored. A pipe, or `NO_COLOR`, prints the same YAML and the same comments with no ANSI sequences.
- `--json` and `--yaml` stay the redacted result, with no comments and no color. A password stays `***`. The comment on a redacted password still names where it came from.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-config/core`: the `variant config` text form annotates each value with its origin and, on a terminal, colors that text like yq. The resolved document still includes detected values and the resolved `variant.main` and `variant.root`.

## Impact

- `packages/variant-config`: remember, per resolved path, which of the five origins supplied the value. That record is not part of the JSON or YAML result.
- `packages/variant-cli`: the text layout of `config` appends the comments and applies the colors. No yq binary.
- `docs/guide/core.md` (the `config` section) and `CHANGELOG.md`.
- [specs/variant-config/core](../../specs/variant-config/core/spec.md).

## Non-goals

- Coloring or annotating any command other than `variant config`.
- Changing the `--json` or `--yaml` documents, or the MCP `variant_config` payload.
- Merging a worktree `variants.yaml` with the main file. One file is still loaded.
- A `--color` flag. The terminal and `NO_COLOR` decide.
- Copying yq's empty color-reset sequences. The visible roles match; those empty sequences do not.
