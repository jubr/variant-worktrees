## 1. Variant root workspace

- [ ] 1.1 Add failing tests in `packages/variant-config/test/root.test.ts` for [specs/variant-config/core | The variant root is a workspace](../../specs/variant-config/core/spec.md#requirement-the-variant-root-is-a-workspace) and [specs/variant-config/core | A variants.yaml symlink in the variant root is an anti-pattern](../../specs/variant-config/core/spec.md#requirement-a-variantsyaml-symlink-in-the-variant-root-is-an-anti-pattern): loading from a root that has no `variants.yaml` and an `AGENTS.md` symlink reads the real file in the main checkout and sets `variant.main` and `variant.root`; a `variants.yaml` symlink in that root is not the loaded file and the warnings name it as an anti-pattern; a real `variants.yaml` in the root stays the file and is not that warning. Verify `bun test packages/variant-config/test/root.test.ts` fails first.

- [ ] 1.2 When the start directory is not a checkout, follow its `AGENTS.md` symlink to the real `variants.yaml` in the checkout. Skip a `variants.yaml` symlink in that directory and add the anti-pattern warning. Verify `bun test packages/variant-config/test/root.test.ts` passes.

## 2. Slug, create, and watch

- [ ] 2.1 Add failing tests for [specs/variant-api/core | Slug resolution](../../specs/variant-api/core/spec.md#requirement-slug-resolution) and [specs/variant-api/core | Worktree coupling](../../specs/variant-api/core/spec.md#requirement-worktree-coupling). A run in the primary checkout resolves `main` and a command prints `${slug}` as `main`. A run in a `feat/add-auth` worktree resolves `add-auth` and prints `add-auth`. `create("foo")` and `watch("foo")` from a variant root that has no `variants.yaml` do not throw `Unable to inspect git worktree` for that root; the watch command runs in `<root>/_v-foo/be` and prints `foo`. `watch("main")` from that root runs in the main checkout. `implode("foo")` from that root removes the worktree through the main checkout. The root with no slug still errors. Verify the new tests fail first.

- [ ] 2.2 Ask git in `variant.main` for `create`, `watch`, `down`, and `implode` when the working directory is the variant root, and expand `${slug}` from the operation slug. Verify the tests from 2.1 pass, and `bun test packages/variant-api/test/worktree.test.ts packages/variant-api/test/watch.test.ts packages/variant-api/test/implode.test.ts packages/variant-api/test/slug.test.ts` passes.

## 3. Play, stop, and implode

- [ ] 3.1 Add failing tests for [specs/variant-vscode/variants-tree | Inline actions](../../specs/variant-vscode/variants-tree/spec.md#requirement-inline-actions) in `packages/variant-vscode/src/variants-view.spec.ts` and `packages/variant-vscode/src/variants-panel.spec.ts`: play, stop, and implode of `foo` with worktree `/work/_v-foo` call watch, down, and implode for slug `foo` with working directory `/work/_v-foo`, not the workspace folder `/work`; play on `main` uses the main checkout. Verify those tests fail first.

- [ ] 3.2 Run those actions with the item's directory and slug from the tree and the panel. Verify `bun test packages/variant-vscode/src/variants-view.spec.ts packages/variant-vscode/src/variants-panel.spec.ts` passes.

## 4. Startup title events at trace

- [ ] 4.1 Add failing tests for [specs/chat-renamer/chat-renaming | Every title event is logged on arrival](../../specs/chat-renamer/chat-renaming/spec.md#requirement-every-title-event-is-logged-on-arrival) and [specs/chat-renamer/chat-renaming | A before-startup decision is logged at trace](../../specs/chat-renamer/chat-renaming/spec.md#requirement-a-before-startup-decision-is-logged-at-trace). In `packages/chat-renamer-api/src/cursor-chat-rename.spec.ts` and `packages/chat-renamer-vscode/src/trigger.test.ts`: a chat that existed before startup gets one `trace` `event` and one `trace` `decision` with `reason="before startup"`, and no `debug` entry for either; a chat created after startup still gets a `debug` `event`; `no first prompt` stays `debug`; a rename stays `info`; a later event of a chat stays `debug` and logs no decision. Verify the new tests fail first.

- [ ] 4.2 Log the first `event` of a session from the decision, at `trace` only for `before startup` and at `debug` otherwise, and keep an already-handled session's `event` at `debug` on arrival. Split `before startup` out of the shared early-exit debug write. Verify `bun test packages/chat-renamer-api packages/chat-renamer-vscode` passes.

- [ ] 4.3 In `openspec/changes/better-logs/specs/chat-renamer/chat-renaming/spec.md`, change only the `before startup` decision from `debug` to `trace` (the requirement sentence and the scenario "Existing chat at editor load"). Leave every other level in that delta. Verify `openspec validate better-logs --type change --strict --no-interactive` passes.

- [ ] 4.4 Update `packages/chat-renamer-vscode/README.md` so the startup `event` and the `before startup` decision are Trace, and Debug remains the level for a title event after startup. Add an Unreleased bullet to `CHANGELOG.md`, `packages/chat-renamer-vscode/CHANGELOG.md`, and `packages/variant-vscode/CHANGELOG.md`: play, stop, and implode use the item's directory, `create` and `watch` from the variant root succeed, a `variants.yaml` symlink there is a warning, and those two startup lines are Trace. Verify the README no longer tells the reader to select Debug for chats that existed before startup.

## 5. Check

- [ ] 5.1 Run `openspec validate --all --strict --no-interactive` and `bun test packages/variant-config/test/root.test.ts packages/variant-api/test/worktree.test.ts packages/variant-api/test/watch.test.ts packages/variant-api/test/implode.test.ts packages/variant-vscode/src/variants-view.spec.ts packages/variant-vscode/src/variants-panel.spec.ts packages/chat-renamer-api packages/chat-renamer-vscode`. Verify both exit 0.
