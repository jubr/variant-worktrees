## Why

`variant` reads `variants.yaml` and the git checkout from the process working directory, so a command about another checkout means `cd` first. Help for the global flags also prints a blank line between each of those flags, which the command's own flags do not.

## What Changes

- Add a global short option `-C <path>` that changes the process directory to `<path>` before configuration is read and before the command runs. There is no long option.
- Accept `-C` before or after the command name. A relative path is resolved from the directory in effect when that `-C` is applied. Repeated `-C` applies left to right.
- A missing value, or a path that is not a directory, fails before the command runs and before configuration is read.
- Stop printing a blank line between rows in the `Global flags` help section. Command `Flags` sections stay as they are.
- Document `-C` with the other global flags, and offer it from the completion scripts. No `--chdir`.

Non-goals: no long form; MCP tools and the editor do not gain `-C`; `--json` and `--yaml` stay off `ui` and `completions`; no new configuration key.

## Capabilities

### New Capabilities

- `variant-cli/working-directory`: `-C <path>` changes directory before configuration is read, with no long option.

### Modified Capabilities

- `variant-api/output-formats`: the `Global flags` help section lists `-C <path>` and has no blank line between its rows.
- `variant-cli/completions`: completion scripts offer `-C` and do not offer a long form.
- `docs/readmes`: the repository README global-flags subsection lists `-C`.

## Impact

- `packages/variant-cli` argument scan, help rendering, and completion model. Configuration loading stays in `variant-config` and still uses the process directory.
- README CLI section, `docs/guide/core.md`, and `CHANGELOG.md`.
- No new dependency. No MCP or editor socket change.
