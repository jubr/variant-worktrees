## 1. Mise minimum version

- [x] 1.1 Add a check to the existing `scripts/` specs (for example `scripts/mise-config.spec.ts`): parse `mise.toml`; when any tool key starts with `packslip:`, `min_version` is set and is at least `2026.9.2` (compare dot-separated numbers). Red first, then set `min_version` (`2026.11.12`, comment `for packslip`) in `mise.toml`, together with the tool-list tidy-up (`node` pin removed, plain `npm:@fission-ai/openspec` pin, `aube` entry removed, stale `[settings.npm]` comments removed). Verify `bun test scripts` passes, `mise ls` resolves the tools, and `openspec --version`, `commitlint --version` and `task --version` still run (the node-runtime spec of `variant-api` no longer calls `mise which node`: see 1.3).
- [x] 1.2 Task-group commit (`chore(mise): require mise 2026.9.2 for packslip`).
- [x] 1.3 `packages/variant-api/src/node-runtime.spec.ts` finds its Node on `PATH` (one that is not Bun, resolved through `process.execPath` so a Mise shim works) instead of `mise which node`. Verify `bun test src/node-runtime.spec.ts` in `variant-api` passes with no `node` in `mise.toml`.
- [x] 1.4 Task-group commit (`fix(variant-api): find Node on PATH in the runtime spec`) with 1.3 and the `mise.toml` and `CONTRIBUTING.md` node edits.

## 2. Contributor guide and skill

- [x] 2.1 `CONTRIBUTING.md` (Tool execution): split the `hook-env` sentence and add the **Cursor** paragraph (`StrReplace` and `Write` over scripting; GNU sed note). Verify the section reads correctly and `scripts/docs-site.spec.ts` stays green.
- [x] 2.2 `.agents/skills/vw-spec-iterate/SKILL.md`: put `name:` and `description:` inside one `---` front matter block. Verify the first lines are `---`, `name:`, `description:`, `---` before the title.
- [x] 2.3 Task-group commit (`docs(contributing): prefer edit tools in Cursor`) for 2.1 and 2.2.

## 3. Gates

- [x] 3.1 `openspec validate --all --strict --no-interactive` and `task check:all` pass.
