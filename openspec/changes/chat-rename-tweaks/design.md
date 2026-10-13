## Context

See proposal.md for why. Numbering lives in `numberedTitle` (`packages/chat-renamer-api/src/chat-title-numbering.ts`). It strips trailing digits from the candidate, so `abc7` beside `abc` becomes `abc2`. Same-base skips already happen in `handleCatalogTitleChange` before that call. Default patterns are the one slug regex in `chat-renamer-config`. `@` paths are separate patterns from `worktreeActivationPatterns`, and an empty prefix list emits none. Palette commands are `contributes.commands` plus `registerRenameChatCommands`. `vsce package` writes beside each extension's `package.json`. Both `chat-renamer-vscode` and `variant-vscode` have a `vsce-package` script. `vsce package` fails `npm list` on workspace packages unless `--no-dependencies` is set, because esbuild already bundles them into `extension.cjs`. `variant-vscode` also has both a `files` field and `.vscodeignore`, which `vsce` refuses together.

## Goals / Non-Goals

**Goals:**

- Both extension package scripts write their vsix under repo `out/`, gitignored.
- Peer numbering that keeps a typed trailing number.
- Default `@` path matching when no worktree prefix is configured, without letting that pattern bypass a non-empty prefix list.
- One palette command that renames the selected chat from its first prompt, ignoring the new-chat age window.
- One log line per rename action: the chat id, why that title was chosen, and the final title.

**Non-Goals:**

- `planExistingRenames` and the creation-order plan. A candidate `def3` beside `def3` and `def5` stays `def3` in `numberedTitle`; the existing-chats plan still groups by base.

## Decisions

### Vsix path

Both package scripts pass `--out` as a file, not a directory. A directory would keep vsce's `<package name>-<version>.vsix`. `chat-renamer-vscode` uses `mkdir -p ../../out && vsce package --no-dependencies --out ../../out/chat-renamer-${npm_package_version}.vsix`. `variant-vscode` uses the same command with `../../out/variant-worktrees-${npm_package_version}.vsix`. Bun sets `npm_package_version` when it runs the script, so the version stays the `package.json` version. `--no-dependencies` is required for either script to produce a file in this workspace. Root `.gitignore` gains `out/`.

`variant-vscode` drops the `files` field. `.vscodeignore` already whitelists `dist`, the README, the changelog, and the license, and `vsce` will not run when both `files` and `.vscodeignore` exist.

Alternative: gitignore `*.vsix` in each package directory. Rejected because the files should not sit in the package tree.

### Typed trailing number

If `titleBase(candidate)` is shorter than `candidate`, `numberedTitle` returns `candidate` and does not consult peers. All-digit titles stay on the existing empty-base path. `numberedTitle("abc7", ["abc"])` returns `abc7`. `numberedTitle("def3", ["def3", "def5"])` returns `def3` (the old `def6` expectation goes). Candidates with no trailing digits keep today's peer math (`abc`+`abc` → `abc2`, `def`+`def3`/`def5` → `def6`, `abc`+`abcd` → `abc`).

`handleCatalogTitleChange` already returns without renaming when the current title shares that base, so a chat already titled `abc7` or `abc` is not renamed. A different current title still renames to the candidate (`New Chat` + `abc7` beside `abc` → `abc7`; `New Chat` + `abc` beside `abcd` → `abc`).

### Default path pattern

Add this source as the first `DEFAULT_ACTIVATION_PATTERNS` entry, exported from `chat-renamer-config` so the host can recognize it:

`/[a-z]+-spec-[a-z]+\s+@\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\s|$)`

`\S+` backtracks to the last slash, so `@/Users/me/_v-outer/_v-inner` captures `inner` and `@/Users/me/vw/_v-cursor-chat-win-rename/` captures `cursor-chat-win-rename`. The lookahead is valid in JavaScript and in Python `re`, which the hook script uses. The pattern does not contain `_v-`. A second default source matches the short form `/<word>-spec-<word> @_work-<slug>` and captures `<slug>`. It stays when a prefix list drops the path pattern.

When `worktreePrefixes` is non-empty, drop that exact path source from the compiled list and keep the generated prefix patterns in front. Each prefix contributes a path pattern and a short `@<prefix><slug>` pattern. A path that matches no configured prefix then produces no title, including `_work-my-slug` while prefixes are `_v-`. When the prefix list is empty, the default path pattern stays. An empty `activationPatterns` array still turns patterns off.

### Active chat command

Add `renameActiveChat` on `ChatRenamerNames` (`<prefix>.renameActiveChat`). Contribute it in both manifests. Register it next to the other rename commands, which already run for an idle instance.

The handler takes the first id from `composer.getOrderedSelectedComposerIds`. No id, or a non-array result: warning, no rename. It then calls the title-event path with `notBeforeMs` at negative infinity and `maxAgeMs` at infinity, so age and startup time do not apply, and `renameExistingDays` is not read. Same-base and numbering stay inside that path. A false result with no request, or with no readable timestamped prompt, warns the user. A same-base skip only logs.

Alternative: an input box for a title. Rejected; the command uses the first prompt.

### Rename action log

`RenameOptions` gains an optional `log`. When it is set, `applyRequest` writes one info line after it has chosen the title and before it writes it:

`rename <sessionId>: <reason>; title <json>`

The reason is chosen from the request, not from the log text:

- not via a pattern → `slash command`
- `titleBase(candidate)` is empty → `all digits`; the title is the candidate
- `titleBase(candidate)` is shorter than the candidate → `typed trailing number kept`; the title is the candidate
- `numberedTitle` differs from the candidate → `numbered against open chats`
- otherwise → `no shared base`

`handleCatalogTitleChange` writes the same shape and does not rename when the current title already shares the base. The reason is `current title shares the base` and the title is the current title. The extension passes its output-channel logger on `options.log` from `registerChatRenamer`, so the title-event path, the URI handler, `renameChatFromPrompt`, and the active-chat command all use it. No logger means no line.

The explicit `renameChat` command logs `explicit title` with the title the caller passed.

Existing-chats lines keep the `[existing-chats]` prefix. Each rename line also includes the reason `existing chats plan` and the final title. `planExistingRenames` stays as it is; the reason is that fixed phrase, not a second numbering explanation.

## Risks / Trade-offs

- [Path regex differs between JS and Python] → Keep the same constructs as `worktreeActivationPatterns` (`\s`, `\S`, a trailing lookahead). A pattern test covers the nested path and the trailing slash.
- [`vsce package` without `--no-dependencies` still fails `npm list`] → Both scripts always pass `--no-dependencies`.
- [Dropping the path pattern by source string misses a hand-edited copy] → Compare to the exported constant. A different user regex can still match an `@` path; the spec case is the default source plus a non-empty prefix list.
- [`numberedTitle("def3", …)` no longer climbs to `def6`] → Accepted. The existing-chats plan is a separate function and stays.

## Migration Plan

No stored data changes. Rollback is reverting the change. An already built vsix inside either extension package can be deleted by hand; new builds go to `out/`.

## Open Questions

None.
