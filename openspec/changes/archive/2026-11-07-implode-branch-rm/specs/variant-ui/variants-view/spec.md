## MODIFIED Requirements

### Requirement: Implode confirmation

Pressing implode SHALL open a confirmation that names the variant and says its database target, its worktree, and its branch are removed. The app SHALL call `implode` with `confirm: true` only after the person accepts, and SHALL do nothing when the person cancels or dismisses it. The call SHALL NOT pass a branch choice, so the implode default applies.

#### Scenario: Accepted

- **WHEN** implode is pressed on `demo` and the person accepts
- **THEN** `implode("demo", true)` is called

#### Scenario: Confirmation names the branch

- **WHEN** implode is pressed on `demo`
- **THEN** the confirmation says the branch of `demo` is removed

#### Scenario: Cancelled

- **WHEN** implode is pressed on `demo` and the person cancels
- **THEN** no action is called
