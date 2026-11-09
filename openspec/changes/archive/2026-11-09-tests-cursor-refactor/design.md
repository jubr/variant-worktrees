## Context

See [proposal.md](proposal.md) for why. Behavior for the layout check is [specs/meta/colocated-tests](specs/meta/colocated-tests/spec.md).

`variant-log`, `variant-ipc`, `variant-server`, `variant-ui`, and most of `variant-vscode` and `chat-renamer-*` already keep `*.spec.ts` under `src/`. `variant-api`, `variant-cli`, `variant-config`, `variant-mcp`, and `chat-renamer-config` still keep `*.test.ts` under `test/`. A few in-source files still use `.test.ts`. Packages that emit declarations exclude either `test` or `src/**/*.spec.ts`. Three `bunfig.toml` files preload `./test/setup.ts`. `variant-ui` exports `./testing` from `src/testing/index.ts`. `openspec/config.yaml` still tells later changes to put tests under each package's `test/` directory. `CONTRIBUTING.md` already asks for `{file}.spec.ts` beside source.

Four source files have a basename starting with `cursor-`: `packages/variant-vscode/src/cursor-command-probe.ts`, `packages/variant-vscode/src/cursor-mcp.d.ts`, `packages/chat-renamer-vscode/src/cursor-host.ts`, and `packages/chat-renamer-api/src/cursor-chat-rename.ts`.

## Goals / Non-Goals

**Goals:**

- One filesystem check, shared by a fixture test and a scan of `packages/`, enforces the delta spec.
- Move today's package tests and their non-test helpers without changing what those tests assert.
- Put the four `cursor-*` modules under `src/cursor/` and leave every other module on its current path, except the Cursor-only modules and functions named in the decisions below.

**Non-Goals:**

- A check that Cursor modules exist. The sibling rule will only notice a `cursor-*` spec that was not moved with its source.
- Publishing test helpers. `variant-ui`'s existing `./testing` export stays the public harness.
- Banning `src/test` for `setup.ts` and similar non-test files.

## Decisions

### Cursor modules are the `cursor-*` basenames, kept as-is

Move each of the four files into `src/cursor/` in the same package and keep the basename (`src/cursor/cursor-host.ts`). Update imports, including `chat-renamer-api`'s barrel. Move a colocated spec with the source so the sibling rule still holds.

Alternatives: strip the `cursor-` prefix (rejected: extra rename on top of the directory move); move `mcp-registration.ts` wholesale (rejected: it still registers the VS Code language-model provider; only the Cursor calls move, in the decision below).

### Cursor-only code in chat-renamer-vscode

`chat-renamer-vscode` has modules that are not named `cursor-*` and still only exist for Cursor's on-disk layout or a private command. Move each whole module under `src/cursor/` and keep the basename: `session-activity.ts` (`~/.cursor/projects/<slug>/agent-transcripts`) and `active-chat.ts` (the selected-composer payload: `composerId`, `sessionId`, `id`). Move each colocated spec with its source.

Extract a Cursor-only function out of a mixed module and leave the rest:

- `readComposerActivity` leaves `awake-watch.ts` for `src/cursor/composer-activity.ts`. The poll loop and `caffeinate` stay.
- the `state.vscdb` path beside an extension's globalStorage becomes `src/cursor/state-db.ts`.
- `composer.getOrderedSelectedComposerIds` becomes `src/cursor/selected-composers.ts`.

`commands.ts`, `trigger.ts`, `existing-chats.ts`, `register.ts`, `settings.ts`, and `log.ts` stay and call those modules. Do not add a test.

### Cursor-only code in chat-renamer-api

Move each whole module that reads Cursor's on-disk chat store, hook files, or composer rows, and keep the basename: `chat-first-prompt.ts`, `chat-rename-hooks.ts`, `composer-activity.ts`. Move each colocated spec with its source. Extract `resolveCursorDir` and `hookCommand` from `chat-rename-settings.ts` into `src/cursor/cursor-dir.ts`. The package barrel re-exports the same names.

### Cursor MCP registration

`mcp-registration.ts` stays, because it also registers the VS Code language-model provider. `registerCursorMcp` and `unregisterCursorMcp` move to `src/cursor/cursor-mcp-server.ts`. Do not add a test.

### One pure check, two callers

`scripts/colocated-tests.ts` takes a workspace-relative path list plus the `packages/<package>/test` directories that exist. It returns the violations in the delta spec:

- each `packages/<package>/test` directory, named as that directory
- a `.spec.ts` or `.spec.tsx` under a `test` segment inside `packages/<package>/src` when that package also has a non-test `.ts` or `.tsx` source with the same stem. A `.d.ts` file does not count as that source. A `.test.ts` or `.test.tsx` under that path always fails. A spec there with no such source does not
- a `.test.ts` or `.test.tsx` anywhere under `packages/`
- a unique source stem whose spec is not in that source file's directory

`src/test/setup.ts`, `src/test/mise-mock.ts`, and any other non-test file under `src/**/test/` are not violations. `scripts/colocated-tests.spec.ts` feeds fixture lists for the failing and passing cases, then feeds the real `packages/` tree. The script does not import package code. `scripts/` is outside the check, which matches the repository-scripts scenario.

Alternatives: a Biome plugin or `hk` linter (rejected: the repo's executable check for this kind of rule is already a `scripts/*.spec.ts`, as with docs coverage); one assertion per package (rejected: a new package would be unchecked); treating `src/test` like `packages/*/test` (rejected: preload and support files belong there).

### Where a moved test file goes

Use `git mv`. For `packages/<pkg>/test/<stem>.test.ts`, if that package has exactly one non-test source stem `<stem>`, the destination is that source file's directory with `<stem>.spec.ts` (or `.spec.tsx` when the source is `.tsx`). Otherwise the destination is `packages/<pkg>/src/<stem>.spec.ts`. Rename in-source `*.test.ts` to `*.spec.ts` in place, then apply the same sibling rule if the source lives elsewhere (`cursor-*` specs follow their modules). Rewrite relative imports (`../src/...` becomes a same-tree import; `./support/...` becomes `./test/...` from a spec in `src/`). Do not change assertions.

Specs with no matching `.ts` or `.tsx` source land in `src/test/` (`product-icon.spec.ts`, `bundle.spec.ts`, `readme.spec.ts`, the manifest specs, `build.spec.ts`). `packages/variant-api/src/db.spec.ts` has no `db` source; its assertions move into `db/sqlite.spec.ts`. `db-failure.spec.ts` moves beside `db/failure.ts` as `failure.spec.ts`. `index` and `types` in `variant-api` are duplicate stems; the check ignores those stems.

### Helpers move to `src/test/`

`packages/*/test` goes away. Non-test files move to `src/test/` in the same package:

- `packages/variant-api/test/support/` → `packages/variant-api/src/test/`, and `fake-mise.ts` becomes `mise-mock.ts`
- `packages/variant-cli/test/support/` → `packages/variant-cli/src/test/`
- `packages/variant-vscode/test/setup.ts` → `packages/variant-vscode/src/test/setup.ts`
- `packages/variant-ui/test/setup.ts` → `packages/variant-ui/src/test/setup.ts`
- `packages/chat-renamer-vscode/test/setup.ts`, `vscode-mock.ts`, and `log.ts` → `packages/chat-renamer-vscode/src/test/`

Point each preload at `./src/test/setup.ts`. Remove empty `packages/*/test` directories. Leave `packages/variant-ui/src/testing/` as the public harness.

Packages that run `tsc` to emit declarations today exclude `test`, which is the package test directory. After the move they exclude `src/**/*.spec.ts`, `src/**/*.spec.tsx`, and `src/**/test/**`, following `variant-log`. That keeps `setup.ts` and support modules out of `dist` and leaves `variant-ui`'s `src/testing` in the compilation. Drop `test/**` from `include` lists that name the package test directory.

### Contributor map matches the layout

Change the OpenSpec context sentence that says tests live under each package's `test/` directory so it names sibling `*.spec.ts` files and allows `src/test` for helpers and for specs that cover no `.ts` or `.tsx` source. Update the `AGENTS.md` package tree the same way. Leave `CONTRIBUTING.md` unless a sentence still tells contributors to add files under `packages/*/test`.

## Risks / Trade-offs

- [Declaration emit picks up a spec or a helper] → exclude `src/**/*.spec.ts`, `src/**/*.spec.tsx`, and `src/**/test/**` before `task build`.
- [Relative imports break after `git mv`] → run the moved package's tests before the repo-wide scan is added.
- [A future test stem matches two new source files] → the check ignores that stem, same as `index` and `types` today. Placement is then "not a test file under `src/**/test`".
- [`src/test` looks like a test home] → the checker still fails a spec placed there when the package has a `.ts` or `.tsx` source with that stem, still fails a `*.test.ts` placed there, and fails the whole `packages/*/test` directory. A spec with no such source may live there.

## Migration Plan

1. Add the checker and fixture tests. They pass without scanning the repo.
2. Move tests, helpers, preloads, and `tsconfig` excludes. Existing tests pass.
3. Scan the real `packages/` tree from the same spec file. It passes.
4. Move the four `cursor-*` modules and their specs. Touched package tests pass. No new test.
5. Update `openspec/config.yaml` and `AGENTS.md`.

Rollback is reverting those commits. No data migration and no release flag.

## Open Questions

None.
