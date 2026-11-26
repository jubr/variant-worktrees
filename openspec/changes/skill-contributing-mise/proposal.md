## Why

`mise.toml` installs this repository's own tool, `variant`, through the `packslip:` backend. Mise before 2026.9.2 has no such backend, so a contributor with an older Mise gets a vague "unknown backend" failure from `mise install` instead of a clear request to update. Separately, the contributor guide and the `vw-spec-iterate` skill have two small defects found while working: the skill's front matter is malformed (its `name` sits under a stray `##` heading, outside the `---` block, so the skill does not load by name), and the guide tells agents to prefer shell scripting for edits that Cursor's `StrReplace` and `Write` tools do better.

## What Changes

- `mise.toml` sets `min_version = "2026.11.12"` (comment: for packslip), the Mise release the repository is developed with. The `packslip:` backend first shipped in 2026.9.2, which is the lowest value the spec allows. Mise older than `min_version` fails up front with a message that names the required version.
- `mise.toml` tidies its tool list: the `node` pin and its note are removed (`aube` runs the npm tools under `bun`; the `variant-api` node-runtime spec looks for a real Node on `PATH` instead of asking `mise which node`), `npm:@fission-ai/openspec` becomes a plain pin (the table with its commented `postinstall` goes), the `github:jdx/aube` entry and the opt-in comment are removed, the `packslip:jubr/variant-worktrees` entry moves below the other tools under the comment "lets use the latest version of ourselves", a comment says `aube` runs the npm tools under `bun`, and two stale comments under `[settings.npm]` go. `package_manager = "aube"` stays.
- `CONTRIBUTING.md` (Tool execution) splits the `mise hook-env` sentence for readability and adds a **Cursor** paragraph: prefer `StrReplace` and `Write` for simple edits, keep scripts for bulk or mechanical rewrites, and note that `sed` under Mise is GNU sed.
- `.agents/skills/vw-spec-iterate/SKILL.md` front matter is fixed: `name:` and `description:` sit inside one `---` block.
- Non-goals: no change to the `packslip:` tool entries that are in use, to the pinned versions, to the Mise `variant init` writes into user projects, or to any product code.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meta/local-checks`: adds the requirement "Mise minimum version".

## Impact

- `mise.toml`: one new top-level key and the tool-list tidy-up above. Active tools and versions are unchanged except `node` and `aube` (no longer listed).
- `packages/variant-api/src/node-runtime.spec.ts`: finds Node on `PATH`; test code only.
- `CONTRIBUTING.md` and `.agents/skills/vw-spec-iterate/SKILL.md`: prose and front matter only.
- Contributors and CI with Mise older than `min_version` now get Mise's own minimum-version error; current Mise is unaffected.
