## Why

`variant config` prints the resolved configuration, including values the file never set, but every line looks the same. A reader cannot tell whether a value was written in a file, filled by a built-in default, discovered, or read from the environment. On a terminal the text is also plain, so it is harder to scan than the same document printed by yq.

## What Changes

- The default text of `variant config` remains the full resolved configuration: file values and the detected values (built-in defaults, autodetection, environment).
- An origin comment is `# from <path>`, `# from env <NAME>`, `# autodetect <reason>`, or `# default`. A file path is relative to the process cwd, `./` when the file is inside it. Examples: `# from ./variants.yaml`, `# from ./variants.local.yaml`, `# from ../variant-worktrees/variants.yaml`, `# from env VARIANT_OPEN`, `# autodetect main`, `# default`.
- When every child of a key shares that key's origin, the comment sits on the key and the children have none. A child whose origin differs is commented on its own line; siblings that still match the parent are not.
- When stdout is a terminal and `NO_COLOR` is unset, that text uses yq's YAML colors: cyan keys, green strings, bright-magenta numbers and booleans, bright-black comments. Null, `[]`, `{}`, colons, and dashes stay uncolored. A pipe, or `NO_COLOR`, prints the same YAML and the same comments with no ANSI sequences.
- `--json` and `--yaml` stay the redacted result, with no comments and no color. A password stays `***`. The comment for a redacted password still names where it came from.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-config/core`: the `variant config` text form annotates origins with `# from <path>`, `# from env <NAME>`, `# autodetect <reason>`, or `# default`, collapses a shared origin onto the parent, and, on a terminal, colors that text like yq. The resolved document still includes detected values and the resolved `variant.main` and `variant.root`.

## Impact

- `packages/variant-config`: remember, per resolved path, which origin supplied the value. That record is not part of the JSON or YAML result.
- `packages/variant-cli`: the text layout of `config` places the comments and applies the colors. No yq binary.
- `docs/guide/core.md` (the `config` section) and `CHANGELOG.md`.
- [specs/variant-config/core](../../specs/variant-config/core/spec.md).

## Non-goals

- Coloring or annotating any command other than `variant config`.
- Changing the `--json` or `--yaml` documents, or the MCP `variant_config` payload.
- Merging a worktree `variants.yaml` with the main file. One file is still loaded. The comment names that file's path.
- A `--color` flag. The terminal and `NO_COLOR` decide.
- Copying yq's empty color-reset sequences. The visible roles match; those empty sequences do not.
