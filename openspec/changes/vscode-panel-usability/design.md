## Context

See proposal.md for motivation. The Explorer section `variant.variants` is a tree view. Its inline actions use the `inline` menu group, which the editor paints only while the pointer is over the row, and a disabled command in that group is dropped rather than shown dimmed with a tooltip. A second view, `variant.onboarding`, is a webview that replaces the tree while the init dialog is open. `variants-expand.ts` focuses `variant.variants` on startup unless `variant.autoExpand` is false; the manifest visibility `visible` also starts the section expanded. `detectOnboarding` and `findConfigFile` live in `variant-config`. The React app in `variant-ui` is what the editor panel and `variant ui` render; `sortVariants` orders its rows and the tree.

## Goals / Non-Goals

**Goals:**

- One adoption result shared by the section and the onboarding notification.
- Startup expansion that does not run detection and does not read the environment.
- Row controls that stay visible, including a disabled implode control whose tooltip still appears.
- One sort implementation that pins `main`, used by the section, the editor panel, and the browser.

**Non-Goals:**

- A second copy of the detection rules in the extension.
- Collapsing a section the person has expanded when no config file exists.
- Changing `collectRecords` or CLI output to invent a `main` row.

## Decisions

**Adoption in `variant-config`.** Export `getVariantsAdoption(dir, environment)` next to `detectOnboarding`. It walks parents for `variants.yaml` then `variants.yml`, the same lookup as `findConfigFile`. A hit returns `{ status: "active" }` and does not call the environment. Otherwise it returns `{ status: "detected", label }` from `detectOnboarding` when that label exists, or `{ status: "none", error? }` when it does not, passing through an environment failure on `error` so the editor can still offer Trust. The onboarding notice calls this instead of combining `hasConfig` and `detectOnboarding` itself. Alternative: a vscode-only helper — rejected, the proposal asks for one method and the detection already lives in `variant-config`.

**The section asks only whether adoption is active.** Expand and the not-initialized introduction do not differ between `detected` and `none`, so the section uses the file lookup and does not call `getVariantsAdoption` (that would run Mise on every startup without a config file). The lookup is the function's active branch, not a second walk. Alternative: call the full function at startup — rejected, it turns a missing config into an environment read and a Trust prompt before any commit.

**Initial visibility `collapsed`, then expand.** The manifest visibility becomes `collapsed`, so the contribution itself does not expand the section. `expandVariantsView` runs only when the file lookup hits and `variant.autoExpand` is not false. It never collapses. A section the person opened therefore stays open across restarts even with no config file. Alternative: remove the view until a config file exists — rejected, the Onboard button has to be reachable in the section.

**Compact webview for the section list.** The tree cannot show a control all the time, and it cannot show a disabled control with a hover tooltip. The section list becomes a webview that loads the variants app in a compact presentation: hollow or filled dot, slug, uptime, one run control, explosion control. The existing onboarding webview still replaces it while the dialog is open. The full row layout (state text, URL, output) stays the panel and the browser. Alternative: keep the tree and accept hover-only actions — rejected by the request. Alternative: put the full React row in the sidebar — rejected, the section is the compact list in the screenshots.

**Synthetic `main` in the extension store only.** When a config file exists and the library returns no `main` record, the store prepends a `down` record titled `main` that is not implodable. The section and the editor panel both read the store, so they match. `sortVariants` then pins any `main` record first; the UI server row stays above that. The browser and the CLI never see the synthetic record. Alternative: synthesize inside `collectRecords` — rejected, CLI listing would grow a row the commands did not create.

**Sort chrome from the manifest.** The current sort is a context key `variant.currentSort`, set from `variant.sort` on startup and whenever that setting changes, defaulting to `name-asc` when unset. The view title contributes one Sort submenu per value, shown only for that value, with label `Sort: <label>` (the tooltip). Each submenu lists every order once, and the selected order's item is a second command whose title is `$(check) ` plus the label; both commands write the same setting. Labels: `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, `Changed (new→old)`. Alternative: one Quick Pick — rejected, the control stays a menu and the tooltip has to name the selection without an extra click.

**Icons.** Watching uses a filled dot colored with the theme `charts.green` (a fixed green fallback when the theme variable is absent). Down uses a hollow dot. Up uses a different shape. The explosion is a monochrome glyph in `currentColor`, opacity reduced when disabled, so it is dim on both themes without a second red asset. The enabled tooltip says implode would succeed; the disabled tooltip says it would fail, or that `main` is never imploded. `up` shows stop and not play: the row's run control matches running versus stopped. Stopping an `up` variant, then play, is how a watch starts from that row.

**Dialog copy.** The confirm button's text is `Initialize`. The command id stays `variant.onboardingInit`. Prefix sits in a `<details>` whose summary is `Advanced`, collapsed, immediately above the button row. The gitignore checkbox stays outside and still shows the pattern for the current prefix. An invalid prefix disables `Initialize` and the reason stays outside the disclosure, so a collapsed Advanced does not hide it.

## Risks / Trade-offs

- [Compact webview loses native tree keyboard and the hover-free virtualization of a tree] → Variants are a short list. Rows are buttons with accessible names; the same actions stay logged and confirmed as they are today.
- [Green depends on the theme] → `charts.green` plus a fallback, and the filled shape plus the tooltip (and the React label) carry the state without colour.
- [Pinning `main` changes browser order] → Intended. The browser does not gain a synthetic row.
- [`up` no longer offers play on the row] → Stop, then play. The watch command itself is unchanged.
- [Disabled explosion removes the click that used to surface the merge error] → The tooltip says implode would fail. No force action is added.

## Migration Plan

No stored data and no setting values change. Ship the section and the app together so the panel does not keep the old icons for a release. Rollback is reverting the change; `variant.sort` values already in user settings stay valid.
