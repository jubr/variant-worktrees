# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
