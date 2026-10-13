## Context

See proposal.md for why. Numbering lives in `numberedTitle` (`packages/chat-renamer-api/src/chat-title-numbering.ts`). It strips trailing digits from the candidate, so `abc7` beside `abc` becomes `abc2`. Same-base skips already happen in `handleCatalogTitleChange` before that call. Default patterns are the one slug regex in `chat-renamer-config`. `@` paths are separate patterns from `worktreeActivationPatterns`, and an empty prefix list emits none. Palette commands are `contributes.commands` plus `registerRenameChatCommands`. `vsce package` writes beside `packages/chat-renamer-vscode/package.json` and fails `npm list` on workspace packages unless `--no-dependencies` is set, because esbuild already bundles them into `extension.cjs`.

## Goals / Non-Goals

**Goals:**

- One package script that actually writes the vsix under repo `out/`, gitignored.
- Peer numbering that keeps a typed trailing number.
- Default `@` path matching when no worktree prefix is configured, without letting that pattern bypass a non-empty prefix list.
- One palette command that renames the selected chat from its first prompt, ignoring the new-chat age window.

**Non-Goals:**

- `planExistingRenames` and the creation-order plan. A candidate `def3` beside `def3` and `def5` stays `def3` in `numberedTitle`; the existing-chats plan still groups by base.
- `variant-vscode`'s `vsce-package` script.

## Decisions

### Vsix path

`packages/chat-renamer-vscode` script `vsce-package` becomes `mkdir -p ../../out && vsce package --no-dependencies --out ../../out`. `--no-dependencies` is required for the script to produce a file in this workspace. `--out` as a directory keeps vsce's `chat-renamer-vscode-<version>.vsix` name. Root `.gitignore` gains `out/`.

Alternative: gitignore `*.vsix` in the package directory. Rejected because the file should not sit in the package tree.

### Typed trailing number

If `titleBase(candidate)` is shorter than `candidate`, `numberedTitle` returns `candidate` and does not consult peers. All-digit titles stay on the existing empty-base path. `numberedTitle("abc7", ["abc"])` returns `abc7`. `numberedTitle("def3", ["def3", "def5"])` returns `def3` (the old `def6` expectation goes). Candidates with no trailing digits keep today's peer math (`abc`+`abc` → `abc2`, `def`+`def3`/`def5` → `def6`, `abc`+`abcd` → `abc`).

`handleCatalogTitleChange` already returns without renaming when the current title shares that base, so a chat already titled `abc7` or `abc` is not renamed. A different current title still renames to the candidate (`New Chat` + `abc7` beside `abc` → `abc7`; `New Chat` + `abc` beside `abcd` → `abc`).

### Default path pattern

Add this source as the first `DEFAULT_ACTIVATION_PATTERNS` entry, exported from `chat-renamer-config` so the host can recognize it:

`/[a-z]+-spec-[a-z]+\s+@\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\s|$)`

`\S+` backtracks to the last slash, so `@/Users/me/_v-outer/_v-inner` captures `inner` and `@/Users/me/vw/_v-cursor-chat-win-rename/` captures `cursor-chat-win-rename`. The lookahead is valid in JavaScript and in Python `re`, which the hook script uses. The pattern does not contain `_v-`.

When `worktreePrefixes` is non-empty, drop that exact source from the compiled list and keep the generated prefix patterns in front. A line of the form `/<word>-spec-<word> @...` that matches no configured prefix then produces no title, including `_work-my-slug` while prefixes are `_v-`. When the prefix list is empty, the default path pattern stays. An empty `activationPatterns` array still turns patterns off.

### Active chat command

Add `renameActiveChat` on `ChatRenamerNames` (`<prefix>.renameActiveChat`). Contribute it in both manifests. Register it next to the other rename commands, which already run for an idle instance.

The handler takes the first id from `composer.getOrderedSelectedComposerIds`. No id, or a non-array result: warning, no rename. It then calls the title-event path with `notBeforeMs` at negative infinity and `maxAgeMs` at infinity, so age and startup time do not apply, and `renameExistingDays` is not read. Same-base and numbering stay inside that path. A false result with no request, or with no readable timestamped prompt, warns the user. A same-base skip only logs.

Alternative: an input box for a title. Rejected; the command uses the first prompt.

## Risks / Trade-offs

- [Path regex differs between JS and Python] → Keep the same constructs as `worktreeActivationPatterns` (`\s`, `\S`, a trailing lookahead). A pattern test covers the nested path and the trailing slash.
- [`vsce package` without `--no-dependencies` still fails `npm list`] → The script always passes `--no-dependencies`.
- [Dropping the path pattern by source string misses a hand-edited copy] → Compare to the exported constant. A different user regex can still match an `@` path; the spec case is the default source plus a non-empty prefix list.
- [`numberedTitle("def3", …)` no longer climbs to `def6`] → Accepted. The existing-chats plan is a separate function and stays.

## Migration Plan

No stored data changes. Rollback is reverting the change. An already built vsix inside `packages/chat-renamer-vscode/` can be deleted by hand; new builds go to `out/`.

## Open Questions

None.
