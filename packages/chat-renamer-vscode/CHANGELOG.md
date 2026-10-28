# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
