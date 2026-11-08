## ADDED Requirements

### Requirement: Detection focuses the Explorer section

When the one-time onboarding notification is shown, the extension SHALL expand the Explorer **Variant Worktrees** section and focus it. It SHALL NOT focus the activity-bar **Variant Worktrees** container. `variant.autoExpand` set to `false` SHALL NOT prevent this focus. A commit that does not show the notification SHALL NOT focus the section because of that commit. Starting `variant.onboardingInit` SHALL focus the initialization dialog in that section, as specified by **Onboarding command and dialog**, including when the person presses `Bootstrap Variant`.

#### Scenario: Notification focuses the section

- **WHEN** the one-time onboarding notification is shown
- **THEN** the Explorer **Variant Worktrees** section is expanded and focused
- **AND** the activity-bar container is not focused

#### Scenario: Auto-expand off still focuses

- **WHEN** `variant.autoExpand` is `false` and the notification is shown
- **THEN** the Explorer section is expanded and focused

#### Scenario: No notification does not focus

- **WHEN** a commit does not show the notification
- **THEN** that commit does not focus the Explorer section

#### Scenario: Command still focuses the dialog

- **WHEN** a person runs `variant.onboardingInit`, including by pressing `Bootstrap Variant`
- **THEN** the initialization dialog is focused in the Explorer section
