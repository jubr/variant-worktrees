## Why

The Variant Worktrees section opens on every workspace and, until a `variants.yaml` exists, only tells the person to add one. Row actions appear on hover, `main` is sorted in with the other slugs and is missing when it has no state file, and a watching variant looks like any other dot. Starting Variant and seeing what is running takes too many steps.

## What Changes

- Auto-expand the Variant Worktrees section on startup when `getVariantsAdoption()` is `active` or `detected` and `variant.autoExpand` is not `false`. With the setting `false`, startup still leaves the section as it was. When adoption is `none`, startup does not expand it.
- Add `getVariantsAdoption()` in `variant-config`. It returns `active` when that config file is found, `detected` with the existing summary (`postgres+vite`, `sqlite+package-script-watch`, and the same database and application kinds) when there is no config file but a database and an application are detected, and `none` otherwise. The one-time onboarding notification uses this result for its `<detected>` text.
- When adoption is not `active`, the section's introduction says variants are not initialized and includes an **Onboard** button that opens the existing initialization dialog.
- Always show a row titled `main` at the top of the variant list, under the UI server row when that row exists, including when the library has no `main` record. Sorting reorders the other rows only. The editor panel shows that same list.
- When a variant's state is `watching`, its list dot is filled green. `down` stays a hollow dot. `up` stays a different icon. The state name in the tooltip (and the text label in the React app) stays, so colour is not the only signal.
- The Sort control's tooltip names the selected order. The menu puts a check on the selected item. Labels use an arrow: `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, `Changed (new→old)`. The stored values (`name-asc`, and the rest) stay. Created order uses `runtime.createdAt` from the variant's `variants.local.yaml`. A missing or ill-formed value falls back to the directory creation time.
- `variant create` writes `variants.local.yaml` in the variant directory with `runtime.createdAt` set to the local time `YYYY-MM-DD_HH:MM:SS`. A later create leaves that value. `up` and `watch` keep it, and for each watch they write `runtime.watches.<key>.pid` (host process), `runtime.watches.<key>.startedAt` (same local timestamp, set when that watch starts) and `runtime.watches.<key>.url` (when the watch has a url template).
- In the Explorer section, play, square stop and the explosion are native inline actions, shown while the pointer is on the row or the row is selected. The run control is **play** (`variant watch`) when the state is `down`, and a **square stop** (`down`) when the state is `watching` or `up`. Exactly one of those two is shown. The implode control is an explosion icon. `main` shows no implode control. Every other row shows the explosion: muted, with a tooltip that implode would fail, when `implodeClean` is false, and enabled when it would succeed. Activating the muted control does not implode. A clean variant other than `main` still asks for confirmation. The editor panel and the browser keep these controls visible on the row.
- The view title shows **Create variant** (`$(add)`) immediately left of Sort. It opens an input box (`createInputBox`) titled `Create variant`. Accepting a slug runs `create`. When that finishes, the section reloads and lists the new variant. Dismissing the box leaves the list unchanged.
- Every **Init** button label becomes **Initialize**. In the onboarding dialog, the `Prefix` field moves into a collapsed **Advanced** disclosure immediately above the buttons.

## Capabilities

### New Capabilities

- `variant-config/adoption`: `getVariantsAdoption()` and the three results `active`, `detected`, and `none`.

### Modified Capabilities

- `variant-vscode/variants-tree`: startup expand from adoption, the not-initialized introduction and Onboard button, the pinned `main` row, the watching dot, sort presentation, inline run and implode controls, and Create variant.
- `variant-vscode/onboarding`: the dialog button label, the Advanced placement of Prefix, and the notification taking its detected summary from adoption.
- `variant-ui/variants-view`: pinned `main`, the watching dot, one run control, and the explosion control, so the editor panel and the browser match the section.
- `variant-config/core`: `runtime.createdAt` and `runtime.watches.<key>.startedAt` on `variants.local.yaml`.
- `variant-api/core`: `create` writes that file; `created` sort reads `runtime.createdAt`.
- `variant-api/runtime`: a started watch records `pid`, `startedAt` and `url`.
- `variant-api/status`: status returns `createdAt` and `startedAt` when the runtime file has them.

## Impact

- `variant-config`: `getVariantsAdoption()` replaces the `detectOnboarding` export. `runtime.createdAt` and `runtime.watches.<key>.startedAt` on the local runtime schema, the example and the JSON schema.
- `variant-api`: `create` writes `variants.local.yaml`; `up` and `watch` record `startedAt` and keep `createdAt`; `list` fills `createdMs` from that timestamp, or from the directory creation time when it is missing or ill-formed.
- `variant-vscode`: expand on startup from adoption, welcome and list presentation, sort menu, Create variant, onboarding page. The section list stays a native tree; its run and implode controls are inline actions.
- `variant-ui`: shared sort and row controls, including the page served by `variant ui`.
- User-facing copy in the repository README, `packages/variant-vscode/README.md`, `docs/guide/core.md`, and `CHANGELOG.md` where they describe the section, the sort labels, the trash icon, or the Init button.

Non-goals: renaming the CLI or MCP `init` command; changing the notification's gates, button (`Bootstrap Variant`), or sentence; hiding the section when no config file exists; changing `variant.autoExpand` or `variant.sort` values; a force-implode control for a variant that would fail the merge check; inventing a `main` row in CLI output or in `variant ui` when the library has none (the editor view and the editor panel do).
