## Why

Startup expands the Explorer **Variant Worktrees** section by running `variant.variants.focus` and then `workbench.action.focusActiveEditorGroup`. That focus command takes the section (and often the sidebar) even when the follow-up tries to hand focus back, so opening a workspace that already uses variants, or only looks ready for them, pulls the editor off the file the person was in. Focus belongs on that section only when onboarding has something to show.

## What Changes

- Startup still expands the Explorer section when adoption is `active` or `detected` and `variant.autoExpand` is not `false`. It does so without focusing the section, the activity bar, or the editor. There is no focus-then-restore.
- When the one-time onboarding notification is shown (a local commit while adoption is `detected`), the Explorer section is expanded and focused. `variant.autoExpand: false` does not suppress that focus.
- `variant.onboardingInit` still expands and focuses the initialization dialog in that section. Nothing else starts that focus.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-vscode/variants-tree`: startup expand no longer focuses the Explorer section or returns focus to the editor, because focus is never taken. The activity-bar container stays unfocused on startup.
- `variant-vscode/onboarding`: showing the one-time notification focuses the Explorer **Variant Worktrees** section. The command requirement is unchanged: starting `variant.onboardingInit` still focuses the dialog.

## Impact

- `packages/variant-vscode/src/variants-expand.ts` and the startup path in `variants-view.ts`. Expand uses the Explorer tree (`variant.variants`) with focus left off. The activity-bar tree (`variant.worktrees`) is not revealed.
- `packages/variant-vscode/src/onboarding-notice.ts`: the shown notification focuses `variant.variants`.
- Tests in `variants-expand.spec.ts`, `variants-view.spec.ts`, and `onboarding-notice.spec.ts`.
- Copy that says startup returns focus to the editor: `packages/variant-vscode/package.json` (`variant.autoExpand`), `packages/variant-vscode/README.md`, and the root `README.md`. `CHANGELOG.md` records the change.
- [specs/variant-vscode/variants-tree](../../specs/variant-vscode/variants-tree/spec.md) and [specs/variant-vscode/onboarding](../../specs/variant-vscode/onboarding/spec.md).

## Non-goals

- Opening or revealing the webview from **Variant: Open Variants Panel**. Startup does not open it today.
- Focusing the activity-bar **Variant Worktrees** container on startup, on detection, or from the onboarding command.
- Changing when the notification appears, its text, its button, or the once-per-workspace record. Existing commits at startup still do not notify and do not focus.
- Opening the initialization dialog on detection. The dialog still opens only from `variant.onboardingInit` (the command, **Onboard**, or **Bootstrap Variant**).
- Changing which adoption results expand on startup, or the meaning of `variant.autoExpand` for that expand. `none` still does not expand. `false` still leaves the section as it was at startup.
- Collapsing a section the person has expanded.
