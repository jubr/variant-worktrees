## Why

The Variant Worktrees section opens on every workspace and, until a `variants.yaml` exists, only tells the person to add one. Row actions appear on hover, `main` is sorted in with the other slugs and is missing when it has no state file, and a watching variant looks like any other dot. Starting Variant and seeing what is running takes too many steps.

## What Changes

- Auto-expand the Variant Worktrees section on startup only when Variant is already in use (`variants.yaml` or `variants.yml` found for the workspace) and `variant.autoExpand` is not `false`. With the setting `false`, startup still leaves the section as it was. Without a config file, startup does not expand it.
- Add `getVariantsAdoption()` in `variant-config`. It returns `active` when that config file is found, `detected` with the existing summary (`postgres+vite`, `sqlite+package-script-watch`, and the same database and application kinds) when there is no config file but a database and an application are detected, and `none` otherwise. The one-time onboarding notification uses this result for its `<detected>` text.
- When adoption is not `active`, the section's introduction says variants are not initialized and includes an **Onboard** button that opens the existing initialization dialog.
- Always show a row titled `main` at the top of the variant list, under the UI server row when that row exists, including when the library has no `main` record. Sorting reorders the other rows only. The editor panel shows that same list.
- When a variant's state is `watching`, its list dot is filled green. `down` stays a hollow dot. `up` stays a different icon. The state name in the tooltip (and the text label in the React app) stays, so colour is not the only signal.
- The Sort control's tooltip names the selected order. The menu puts a check on the selected item. Labels use an arrow: `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, `Changed (new→old)`. The stored values (`name-asc`, and the rest) stay.
- Each variant row always shows its run control and its implode control, not only while the pointer is over the row. The run control is **play** (`variant watch`) when the state is `down`, and a **square stop** (`down`) when the state is `watching` or `up`. Exactly one of those two is shown. The implode control is an explosion icon. It is dimmed and disabled when the variant cannot be imploded (`main`, or `implodeClean` false), and its tooltip still shows on hover. A clean variant other than `main` stays enabled and still asks for confirmation.
- Every **Init** button label becomes **Initialize**. In the onboarding dialog, the `Prefix` field moves into a collapsed **Advanced** disclosure immediately above the buttons.

## Capabilities

### New Capabilities

- `variant-config/adoption`: `getVariantsAdoption()` and the three results `active`, `detected`, and `none`.

### Modified Capabilities

- `variant-vscode/variants-tree`: startup expand, the not-initialized introduction and Onboard button, the pinned `main` row, the watching dot, sort presentation, and the always-visible run and implode controls.
- `variant-vscode/onboarding`: the dialog button label, the Advanced placement of Prefix, and the notification taking its detected summary from adoption.
- `variant-ui/variants-view`: pinned `main`, the watching dot, one run control, and the explosion control, so the editor panel and the browser match the section.

## Impact

- `variant-config`: `getVariantsAdoption()` next to `detectOnboarding` and `findConfigFile`, exported from the package.
- `variant-vscode`: expand on startup, welcome and list presentation, sort menu contribution, onboarding page. The section list cannot keep using hover-only tree inline actions; see design.
- `variant-ui`: shared sort and row controls, including the page served by `variant ui`.
- User-facing copy in the repository README, `packages/variant-vscode/README.md`, `docs/guide/core.md`, and `CHANGELOG.md` where they describe the section, the sort labels, the trash icon, or the Init button.

Non-goals: renaming the CLI or MCP `init` command; changing the notification's gates, button (`Bootstrap Variant`), or sentence; hiding the section when no config file exists; changing `variant.autoExpand` or `variant.sort` values; a force-implode control for a variant that would fail the merge check; inventing a `main` row in CLI output or in `variant ui` when the library has none (the editor view and the editor panel do).
