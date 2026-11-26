## 1. Mise minimum version

- [ ] 1.1 Add a check to the existing `scripts/` specs (for example `scripts/mise-config.spec.ts`): parse `mise.toml`; when any tool key starts with `packslip:`, `min_version` is set and is at least `2026.9.2` (compare dot-separated numbers). Red first, then set `min_version = "2026.9.2"` with an `AIDEV-NOTE` in `mise.toml`, together with the tool-list tidy-up (`node` commented out, plain `npm:@fission-ai/openspec` pin, opt-in `packslip:jdx/aube` comment, stale `[settings.npm]` comments removed). Verify `bun test scripts` passes, `mise ls` resolves the tools, and `openspec --version`, `commitlint --version` and `task --version` still run (the npm shims need a node: confirm one is found without the `node` pin, else restore it).
- [ ] 1.2 Task-group commit (`chore(mise): require mise 2026.9.2 for packslip`).

## 2. Contributor guide and skill

- [ ] 2.1 `CONTRIBUTING.md` (Tool execution): split the `hook-env` sentence and add the **Cursor** paragraph (`StrReplace` and `Write` over scripting; GNU sed note). Verify the section reads correctly and `scripts/docs-site.spec.ts` stays green.
- [ ] 2.2 `.agents/skills/vw-spec-iterate/SKILL.md`: put `name:` and `description:` inside one `---` front matter block. Verify the first lines are `---`, `name:`, `description:`, `---` before the title.
- [ ] 2.3 Task-group commit (`docs(contributing): prefer edit tools in Cursor`) for 2.1 and 2.2.

## 3. Gates

- [ ] 3.1 `openspec validate --all --strict --no-interactive` and `task check:all` pass.
