## ADDED Requirements

### Requirement: Bun check

`init` SHALL run the check of [specs/tools/mise | Bun on PATH matches the Bun Mise pins](../../tools/mise/spec.md#requirement-bun-on-path-matches-the-bun-mise-pins) for the directory it acts on, with the process environment, whatever steps are on, and report it in its result as `bun`: a `status` of `matches`, `differs` or `unchecked` (no Mise executable, no Bun pinned, no `bun` on `PATH`, or a failed probe), a one-line `message`, and `hint`, a list of lines that is empty unless the status is `differs`. A `differs` result SHALL carry the same versions, paths and hint lines as the warning. The check SHALL NOT fail `init`, SHALL NOT stop another step and SHALL NOT change any file. The text output of the CLI SHALL show the message and the hint lines, and the editor confirmation SHALL name a difference.

#### Scenario: Differing Bun

- **WHEN** `init` runs in a directory whose Mise pins `bun` 1.4.2 and the first `bun` on `PATH` is 1.3.0
- **THEN** the result has `bun.status` `differs`, a message that names both versions and a non-empty `hint`, and the other steps are done as usual

#### Scenario: Matching Bun

- **WHEN** the first `bun` on `PATH` is the pinned version
- **THEN** `bun.status` is `matches` and `bun.hint` is empty

#### Scenario: Not checkable

- **WHEN** no Mise executable is found
- **THEN** `bun.status` is `unchecked` and `init` succeeds
