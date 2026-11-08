# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- Holds the Mac awake with one `caffeinate` process while a chat is taking a turn or generating, including tool work of that turn. `chat-renamer.awake.when` is `chatsActive` (default) or `never`. `chat-renamer.awake.what` `screen` (default) runs `caffeinate -disu`; `cpu` runs `caffeinate -dis`. `chat-renamer.awake.graceDelaySecs` (default `60`, `0` stops at once) keeps that process after the last turn. An open, selected, or idle chat does not count. The enable setting does not turn this off.

## [0.0.7] - 2026-11-06

### Release notes

- feat(variant-vscode): show the variants tree on the activity bar by @jubr in https://github.com/jubr/variant-worktrees/pull/35
- feat: use the worktree config and cache runtime state by @jubr in https://github.com/jubr/variant-worktrees/pull/36
- feat: keep reads working when the database is down by @jubr in https://github.com/jubr/variant-worktrees/pull/37

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.6...v0.0.7

## [0.0.6] - 2026-11-05

### Changed

- A title event for a chat that already existed at startup, and the decision that skips it (`before startup`), are
  logged at Trace. A title event after startup stays at Debug.

### Release notes

- feat: schema warnings, port range, instances to watches, config migration by @jubr in https://github.com/jubr/variant-worktrees/pull/25
- feat: variant init, Mise environment, and editor onboarding by @jubr in https://github.com/jubr/variant-worktrees/pull/26
- feat(api)!: trace dirty worktrees in the implode report by @jubr in https://github.com/jubr/variant-worktrees/pull/27
- fix: watch from the variant root and quiet startup title events by @jubr in https://github.com/jubr/variant-worktrees/pull/28
- feat: make the explorer section easier to use by @jubr in https://github.com/jubr/variant-worktrees/pull/29
- fix(chat-renamer): rename the chat the user is working in by @jubr in https://github.com/jubr/variant-worktrees/pull/30
- feat: postgres multi-schema variants by @jubr in https://github.com/jubr/variant-worktrees/pull/31
- feat: start new variant worktrees at --from by @jubr in https://github.com/jubr/variant-worktrees/pull/32
- feat(variant-vscode): force dirty implode and open row URL by @jubr in https://github.com/jubr/variant-worktrees/pull/33

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.5...v0.0.6

## [0.0.5] - 2026-11-03

### Release notes

- ci(release): run publish-extensions after release via workflow_run by @jubr in https://github.com/jubr/variant-worktrees/pull/16
- feat: split variant.main from variant.root; git-ignore worktrees inside main by @jubr in https://github.com/jubr/variant-worktrees/pull/17
- feat(variant-api)!: status command, text output with --json/--yaml, richer list by @jubr in https://github.com/jubr/variant-worktrees/pull/18
- feat(variant-cli)!: variant-cli package, variant-api runs on Node 22.13+ by @jubr in https://github.com/jubr/variant-worktrees/pull/19
- feat: variants view, panel, and variant ui by @jubr in https://github.com/jubr/variant-worktrees/pull/21
- feat(config)!: reshape instance env, url, implode and container settings by @jubr in https://github.com/jubr/variant-worktrees/pull/20
- feat: shell completions for zsh, bash, and fish by @jubr in https://github.com/jubr/variant-worktrees/pull/22
- feat(release): task release:prepare, shorter tagline, drop broken README image by @jubr in https://github.com/jubr/variant-worktrees/pull/23

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.4...v0.0.5

## [0.0.4] - 2026-10-29

### Fixed

- Chats are renamed again on Cursor builds that keep a chat's message headers in separate store rows instead of the chat record. The first prompt is read from the new layout and falls back to the older one, so builds that worked before still work. Before, such chats were ignored with `no first prompt`.

### Added

- When the first prompt of a new chat cannot be read, the first 5 such chats since the editor started get a Trace entry (`[title-event] unreadable`) showing what Cursor's store held, and the first one shows a warning notification.

## [0.0.3] - 2026-10-28

### Added

- Every title event Cursor delivers is logged at Debug level (`[title-event] event session=… title=…`), also later events of a chat, so the log shows whether an event arrived.

## [0.0.2] - 2026-10-27

### Added

- `chat-renamer.titleEventPromptLines` (default 10): how many lines of a new chat's first prompt the title event tests for a rename request.
- One `[title-event] decision` log line per new chat: whether a slash command or pattern matched, which pattern, the decision and the reason. The prompt lines read are logged at Trace level.

### Changed

- The log is a log output channel, so **Developer: Show Logs…** lists it and its level can be set. Log entries are leveled and structured (`[category] message key=value`).
- A rename that fails shows a notification with the cause. **Rename active chat** says why a chat was not renamed.

# [0.0.1]

- Extracted from the Variant extension: `/chat-rename` and `/rename-chat`, activation patterns, numbered titles, `titleEvent` and `hook` triggers.
