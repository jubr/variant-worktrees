# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- A focused file inside the main checkout or a variant worktree highlights that row in a visible Variant Worktrees tree and does not take editor focus.

## [0.0.8] - 2026-11-11

### Added

- The embedded chat renamer holds the Mac awake with one `caffeinate` process per host while a chat in that host is taking a turn or generating, including tool work of that turn. A chat in another workspace does not count. `variant.awake.when` is `chatsActive` (default) or `never`. `variant.awake.what` `screen` (default) runs `caffeinate -disu -w <host-pid>`; `cpu` runs `caffeinate -dis -w <host-pid>`. The child exits when that host exits. `variant.awake.graceDelaySecs` (default `60`, `0` stops at once) keeps that process after the last turn. An open, selected, or idle chat does not count. `variant.enable` does not turn this off.
- The extension registers the `variant` MCP server for the open workspace in Cursor and VS Code. The `mcp.json` snippet stays the setup for other clients.

### Changed

- Startup expands the Explorer **Variant Worktrees** section without taking focus. The one-time onboarding notification focuses that section.
- Onboarding initializes the main checkout when the opened workspace folder has no `.git` directory.

### Release notes

- feat: publish local bleeds beside the checkout by @jubr in https://github.com/jubr/variant-worktrees/pull/39
- feat(cli): print the version banner and build time by @jubr in https://github.com/jubr/variant-worktrees/pull/40
- docs(agents): spell out variant lifecycle by @jubr in https://github.com/jubr/variant-worktrees/pull/42
- Initialize onboarding in the main checkout by @jubr in https://github.com/jubr/variant-worktrees/pull/43
- ci(release): sign variant executables with packslip by @jubr in https://github.com/jubr/variant-worktrees/pull/44
- feat: fast-forward the start branch with --pull-ff by @jubr in https://github.com/jubr/variant-worktrees/pull/45
- feat: remove the local branch on implode by @jubr in https://github.com/jubr/variant-worktrees/pull/46
- feat: install Mise tools when creating a worktree by @jubr in https://github.com/jubr/variant-worktrees/pull/47
- feat(vscode): register the MCP server from the extension by @jubr in https://github.com/jubr/variant-worktrees/pull/48
- feat: consolidate logs onto one event by @jubr in https://github.com/jubr/variant-worktrees/pull/49
- Record workflow rules and fix CLI text by @jubr in https://github.com/jubr/variant-worktrees/pull/51
- fix(variant-vscode): expand the section without taking focus by @jubr in https://github.com/jubr/variant-worktrees/pull/52
- feat(chat-renamer): hold the Mac awake during a chat turn by @jubr in https://github.com/jubr/variant-worktrees/pull/50
- test(cli): expect sanitized version slug by @jubr in https://github.com/jubr/variant-worktrees/pull/54
- test: colocate package specs and nest cursor modules by @jubr in https://github.com/jubr/variant-worktrees/pull/55
- Log quietly in temporary directories and quote shell commands by @jubr in https://github.com/jubr/variant-worktrees/pull/56
- feat: share one watch log and wait for the last ready URL by @jubr in https://github.com/jubr/variant-worktrees/pull/57
- fix(chat-renamer): reap caffeinate with the host by @jubr in https://github.com/jubr/variant-worktrees/pull/58
- fix(chat-renamer): ignore a leftover generation id by @jubr in https://github.com/jubr/variant-worktrees/pull/59
- fix(chat-renamer): treat unfinished runs as active by @jubr in https://github.com/jubr/variant-worktrees/pull/60

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.7...v0.0.8

## [0.0.7] - 2026-11-06

### Added

- An activity-bar **Variant Worktrees** tree lists the same rows as the Explorer section, with icon `vw-mini-icon.svg`.

### Release notes

- feat(variant-vscode): show the variants tree on the activity bar by @jubr in https://github.com/jubr/variant-worktrees/pull/35
- feat: use the worktree config and cache runtime state by @jubr in https://github.com/jubr/variant-worktrees/pull/36
- feat: keep reads working when the database is down by @jubr in https://github.com/jubr/variant-worktrees/pull/37

**Full Changelog**: https://github.com/jubr/variant-worktrees/compare/v0.0.6...v0.0.7

## [0.0.6] - 2026-11-05

### Added

- The same rewrite adds the `yaml-language-server` schema header to a configuration file that has none.
- A configuration that uses `instances` or `reservedPorts` is rewritten to `watches` and `ports.range` when
  `variants.yaml` is tracked by git and clean; a warning with the actions **Open file** and **Undo** names the change.
- A variant row with a URL has **Open url** immediately left of the run control. It opens the URL in the external
  browser, or in a Cursor browser tab while Alt is held. The muted explosion asks whether to pass `--force` instead of
  doing nothing. A failed watch, down, or implode shows the error in a notification.

### Changed

- **Breaking:** the view and the panel use `watches` for what they called instances (the rows, the runtime state).
- Play, stop and implode run in the item's directory: the variant worktree, or the main checkout for `main`. `create`
  and `watch` of an explicit slug from the variant root succeed, and a `variants.yaml` symlink in that root is a warning.

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
