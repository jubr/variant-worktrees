## Why

Trying `variant init` from the editor on a fresh project (a plain npm extension with a `watch` script, no database) goes wrong in five places that a first-time user meets in a row:

1. `variants.yaml` gets a `db: dialect: sqlite` block although no database was detected. It pins a choice that autodetection already makes, and it is noise in a file that is meant to stay minimal.
2. The mise step adds `github:jubr/variant-worktrees`. The documented installation (`mise x packslip:jubr/variant-worktrees@ -- variant init`) uses the `packslip:` backend, which verifies the signed release, so the mise file should name the same tool.
3. `variant init` writes a `variants.yaml` without the `yaml-language-server` schema header that `variant-config/core` says every `variants.yaml` begins with. The next `variant` command or editor load then "migrates" the file it just wrote: it saves `variants.yaml~`, and prints *"updated to the current names and format ... git cannot revert the change: the old text is saved as ..."* for what is only a header.
4. Pressing play on the `main` row fails with *"nothing was started: no watch has a watch command"* although `variants.yaml` has `watch: npm run watch`. The extension keeps the library client it made when the folder was first used, and that client holds the configuration it read then (before init wrote the file). Editing `variants.yaml` does not reach it until the window is reloaded.
5. The Bun-on-PATH warning that appears beside it tells the person to "delete /opt/mise/installs/bun/1.4.4/bin/bun, or uninstall the package". That Bun is a Mise install of another version that the editor inherited from the shell it was started in; deleting it is the wrong advice.

## What Changes

- `variant init` writes no `db` key when no database setting is detected. A detected database is written as before.
- `variant init` writes the schema header (and a blank line) as the first lines of the new `variants.yaml`, above the existing "Written by `variant init`" comment, so the file needs no migration afterwards and no `variants.yaml~` appears.
- The mise step adds `"packslip:jubr/variant-worktrees" = "latest"`. A configuration that already lists either the `packslip:` or the `github:` entry of this tool is left unchanged, so existing projects are not given a second entry.
- The Bun-on-PATH warning stops telling people to delete a Mise-managed Bun. When the first `bun` is another version under a Mise `installs` directory, the hint says it was inherited from a process with another Mise environment and to start the editor or terminal again from a clean shell.
- The extension's actions (play, stop, implode) use the configuration as it is on disk when the action runs: a changed `variants.yaml` is read by the next action without reloading the window.
- Docs, README and CHANGELOG name the new mise entry and the minimal file.
- Non-goals: no change to what the migration does for older files; no change of when the Bun-on-PATH warning appears; no failure notification for a watch that started nothing; the mise step does not rewrite an existing `github:` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-api/init`: "Init writes autodetected values" omits `db` when nothing is detected and begins the file with the schema header.
- `tools/mise`: "Augmenting the Mise configuration" adds the `packslip:` tool and treats the `github:` entry as already listed; "Bun on PATH matches the Bun Mise pins" gives its own hint when the first Bun is another Mise install.
- `variant-vscode/variants-tree`: a new requirement, "Actions read the current configuration".

## Impact

- `packages/variant-config/src/init-config.ts`, `packages/variant-api/src/mise-augment.ts`, `packages/variant-api/src/mise-bun.ts`, `packages/variant-vscode/src/variants-client.ts`, and their sibling specs.
- `README.md`, `docs/guide/commands.md`, `docs/guide/installation.md`, `CHANGELOG.md`.
- Example `mise.toml` of `example/` keeps its `github:` entry (inside this repository the CLI comes from the workspace).
