## 1. Docs tests first (red)

- [ ] 1.1 `docs-site.spec.ts`: sidebar order Overview, Installation, Commands, CLI, Configuration, Runtime, Workspace; verify the test fails before the sidebar change
- [ ] 1.2 `docs-site.spec.ts`: Configuration second-level sections in the new order; *Custom Steps* and *Custom multi-tenancy steps* hold their YAML, the order sentence, the `custom1` / `runAfter: watch` example and the `db.multi` links; verify red
- [ ] 1.3 `docs-site.spec.ts`: Overview has an Installation section before Flow of Steps linking to `/guide/installation`, no custom-step sections, and ends with *Next steps* as a list with the required links; `db.multi` links to `/guide/configuration#custom-multi-tenancy-steps`; verify red
- [ ] 1.4 `docs-site.spec.ts`: Installation headings in order, `mise activate`, extension text, `packslip:` command with example output, link to `/guide/commands#variant-init`, no repeated `.gitignore` or `mise.toml` prose, fenced `variant:` YAML; verify red
- [ ] 1.5 Replace the old overview-based custom-step assertions in `docs-site.spec.ts` and `docs-coverage.spec.ts` (if any) so the suite expects the new places

## 2. Configuration

- [ ] 2.1 Move *Custom Steps* and *Custom multi-tenancy steps* from `docs/guide/overview.md` to `docs/guide/configuration.md`, before *Templates*; links to keys use the Configuration anchors; `task docs:build` and the Configuration tests (1.2) pass
- [ ] 2.2 Add the sentence that several `runBefore` or `runAfter` steps run in the order defined in `variants.yaml`, and the `custom1` with `runAfter: watch` example with `variant watch` running create, provision, seed, watch, custom1; 1.2 passes
- [ ] 2.3 Point `db.multi` at `./configuration#custom-multi-tenancy-steps` (same page link) and update every other link to the old Overview anchors (`grep -rn "overview#custom" docs README.md` is empty)

## 3. Overview

- [ ] 3.1 Add an *Installation* section before *Flow of Steps* linking to Installation; keep `VARIANT_STEP_<STEP>=no` in the intro; 1.3 passes for the step
- [ ] 3.2 Add the closing section *Next steps* as a list with deep links to Extension, Workspace, `variants.yaml` options, CLI and Commands, and Runtime; 1.3 passes

## 4. Installation

- [ ] 4.1 Capture real output of `mise x packslip:jubr/variant-worktrees@ -- variant init` in a scratch project and the `variants.yaml` it writes; remove machine paths and secrets
- [ ] 4.2 Rewrite `docs/guide/installation.md` as steps 1, 2a, 2b and 3 with the captured outputs; link to `commands#variant-init` instead of repeating; mention `mise activate`; 1.4 passes
- [ ] 4.3 Move *Installation* after *Overview* in `docs/.vitepress/config.ts`; 1.1 passes; links from other pages to Installation still resolve

## 5. Docs of the docs

- [ ] 5.1 `CHANGELOG.md` *Unreleased*: the moved sections and anchors (BREAKING, docs URLs), the Installation rewrite, the sidebar order, *Next steps*
- [ ] 5.2 `README.md` and `CONTRIBUTING.md`: names of these sections or anchors updated where they occur (`grep` shows none stale)

## 6. Verify

- [ ] 6.1 `task docs:build`, `task check:full`, and `openspec validate --all --strict --no-interactive` pass
- [ ] 6.2 Look at the built Overview, Installation and Configuration pages in the browser (outline, sidebar order, links)
