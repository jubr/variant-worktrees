# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
- `variant --version` and `--help` report the package version instead of a fixed `v0.0.1`.

### Added

- When the first prompt of a new chat cannot be read, the first 5 such chats since the editor started get a Trace entry (`[title-event] unreadable`) showing what Cursor's store held, and the first one shows a warning notification.

### Changed

- The extension description and README tagline: `Isolated worktree+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode`. The README now tells why and how first, and links to the online docs.

### Removed

- **BREAKING** The `switch` command: it is no longer listed as a refused lifecycle command and fails as an unsupported editor request. `variant switch`, the `variant_switch` MCP tool, `client.switch()` and `switchWorktree` are gone from the library and CLI.

## [0.0.3] - 2026-10-28

### Added

- Every title event Cursor delivers is logged at Debug level (`[title-event] event session=… title=…`), also later events of a chat, so the log shows whether an event arrived.

## [0.0.2] - 2026-10-27

### Added

- `variant.titleEventPromptLines` (default 10) and the `chatRenamer.titleEventPromptLines` option of `variants.yaml`: how many lines of a new chat's first prompt the title event tests.
- One `[title-event] decision` log line per new chat, and the prompt lines read at Trace level.

### Changed

- The **Variant Worktrees** log is a log output channel, listed by **Developer: Show Logs…**.
- A rename that fails shows a notification with the cause.

# [0.0.1]

- Created this extension!
