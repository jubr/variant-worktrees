# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `variant.titleEventPromptLines` (default 10) and the `chatRenamer.titleEventPromptLines` option of `variants.yaml`: how many lines of a new chat's first prompt the title event tests.
- One `[title-event] decision` log line per new chat, and the prompt lines read at Trace level.

### Changed

- The **Variant Worktrees** log is a log output channel, listed by **Developer: Show Logs…**.
- A rename that fails shows a notification with the cause.

# [0.0.1]

- Created this extension!
