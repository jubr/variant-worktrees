## Context

See proposal.md for motivation. The Explorer section `variant.variants` is a tree view. Its inline actions use the `inline` menu group, which the editor paints only while the pointer is over the row, and a disabled command in that group is dropped rather than shown dimmed with a tooltip. A second view, `variant.onboarding`, is a webview that replaces the tree while the init dialog is open. `variants-expand.ts` focuses `variant.variants` on startup unless `variant.autoExpand` is false; the manifest visibility `visible` also starts the section expanded. `detectOnboarding` and `findConfigFile` live in `variant-config`. `detectOnboarding` is exported and used only by the editor notice, which reads `label` and `error` after its own config-file check. The React app in `variant-ui` is what the editor panel and `variant ui` render; `sortVariants` orders its rows and the tree.

## Goals / Non-Goals

**Goals:**

- One adoption result shared by the section and the onboarding notification.
- Startup expansion when adoption is `active` or `detected`.
- A native section list. The state dot is the left icon. Play, stop and explode are inline actions.
- One sort implementation that pins `main`, used by the section, the editor panel, and the browser.

**Non-Goals:**

- A second copy of the detection rules in the extension.
- Collapsing a section the person has expanded when no config file exists.
- Changing `collectRecords` or CLI output to invent a `main` row.

## Decisions

**Adoption replaces `detectOnboarding`.** Export `getVariantsAdoption(dir, environment)` and delete the `detectOnboarding` export and the `OnboardingDetection` type. The function walks parents for `variants.yaml` then `variants.yml`, the same lookup as `findConfigFile`. A hit returns `{ status: "active" }` and does not call the environment. Otherwise it runs the detection that `detectOnboarding` runs today and returns `{ status: "detected", label }` or `{ status: "none", error? }`. The notice and the section's startup expand call this. `active` is the old `hasConfig` skip. `detected.label` is the old label. `none` with `error` is the old environment failure, so Trust still runs. `database` and `applications` stay inside the function; the label is their join, and no caller outside the tests reads them. `findConfigFile`, `detectWatches`, `detectConnection` and `detectScriptWatches` stay. Alternative: keep `detectOnboarding` as a second export that adoption calls — rejected, the notice is the only caller and the two results would drift.

**The section expands when adoption is not `none`.** Startup calls `getVariantsAdoption` for the first workspace folder. `active` or `detected`, with `variant.autoExpand` not `false`, expands the section and then returns focus to the editor. `none` leaves it collapsed. `variant.autoExpand` set to `false` leaves the section as it was. The call is shared with the notice, so a missing config file runs detection once. `active` still skips the environment. `detected` and `none` read it, because that is how those two results are told apart. An environment failure is `none` with `error`, so the section stays collapsed and the notice can still offer Trust.

**Initial visibility `collapsed`, then expand.** The manifest visibility becomes `collapsed`, so the contribution itself does not expand the section. `expandVariantsView` runs for `active` and `detected` when `variant.autoExpand` is not false. It never collapses. A section the person opened therefore stays open across restarts, including when adoption is `none`. Alternative: remove the view until a config file exists — rejected, the Onboard button has to be reachable in the section.

**The section list stays the native tree, and the row actions are inline.** The webview is not used for the list. The onboarding dialog stays the separate webview that replaces the tree while it is open. The state dot is the row's left icon, always visible: hollow, filled green, or the up shape. Play, square stop and the explosion are `view/item/context` actions in the `inline` group. The host shows that group while the pointer is on the row or the row is selected. A disabled command in that group is omitted, so a row with `implodeClean` false contributes a muted explosion command whose title is the tooltip. Activating it does not open the confirm dialog and does not call `implode`. The `main` row contributes no implode command. The React panel and the browser keep the explosion visible on every row except `main`, with the dirty row's button muted and disabled.

**Create variant sits left of Sort.** The view title gains `$(add)` in the navigation group immediately before Sort. The command title and the input title are `Create variant`. Activating it opens `window.createInputBox()`. The box's `title` is `Create variant`. Accepting a slug runs `create`. An empty value is rejected in the box and does not run `create`. Dismissing the box does not run `create`. When `create` finishes, the section reloads its rows and the new variant is listed. The input's extra buttons are icons with a tooltip; the words `Create variant` are the title. Alternative: `showInputBox` — rejected, the request names `createInputBox`. Alternative: a last row that becomes a text field — rejected, `TreeItem` has no input.

**Synthetic `main` in the extension store only.** When a config file exists and the library returns no `main` record, the store prepends a `down` record titled `main` that is not implodable. The section and the editor panel both read the store, so they match. `sortVariants` then pins any `main` record first; the UI server row stays above that. The browser and the CLI never see the synthetic record. Alternative: synthesize inside `collectRecords` — rejected, CLI listing would grow a row the commands did not create.

**Created time lives in `variants.local.yaml`.** The runtime file in the variant directory (the worktree, or the main checkout for `main`) stays `variants.local.yaml`. `variant create` writes it with `runtime.createdAt: YYYY-MM-DD_HH:MM:SS`, zero-padded, 24-hour, local timezone, underscore between date and time, no offset. A second create does not change it. `up` and `watch` merge the runtime section and keep `createdAt`. Each watch they start gets `startedAt` in that same shape, plus the `pid` of a host process and the rendered `url` when the watch has a url template. `list` sets `createdMs` by reading `createdAt` as local time. A missing or ill-formed value, including a local file that fails to load, uses the directory's creation time (`birthtime`). A record with no directory still omits `createdMs`. `changedMs` stays the later modification time of the directory and the local file. Alternative: treat a missing time as older than every known time — rejected, an existing worktree still has a creation time. Alternative: store an offset or UTC — rejected, the requested text is local wall time with no suffix.

**Sort chrome from the manifest.** The current sort is a context key `variant.currentSort`, set from `variant.sort` on startup and whenever that setting changes, defaulting to `name-asc` when unset. The view title contributes one Sort submenu per value, shown only for that value, with label `Sort: <label>` (the tooltip). Each submenu lists every order once, and the selected order's item is a second command whose title is `$(check) ` plus the label; both commands write the same setting. Labels: `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, `Changed (new→old)`. Alternative: one Quick Pick — rejected, the control stays a menu and the tooltip has to name the selection without an extra click.

**Icons.** Watching uses a filled dot colored with the theme `charts.green` (a fixed green fallback when the theme variable is absent). Down uses a hollow dot. Up uses a different shape. The explosion is a monochrome glyph in `currentColor`. A row with `implodeClean` false uses the same glyph at reduced opacity, as its own command in the tree and as a disabled button in React. `main` has no explosion. The enabled tooltip says implode would succeed; the muted tooltip says it would fail. `up` shows stop and not play: the row's run control matches running versus stopped. Stopping an `up` variant, then play, is how a watch starts from that row.

**Extension tests stay on `mocks/vscode.ts`.** That is the runner `CONTRIBUTING.md` specifies, and it can record the adoption result, the focus command, the inline contributions, `createInputBox`'s title, accept, dismiss, and the reload. A clean VS Code from `@vscode/test-electron` can host the real tree and the real input in an empty user-data directory. This change does not add that runner. Hover painting is the workbench applying the `inline` group; an in-host test does not move the pointer. The same runner can target a Cursor binary with its own user-data directory. The instance that runner downloads is VS Code.

**Dialog copy.** The confirm button's text is `Initialize`. The command id stays `variant.onboardingInit`. Prefix sits in a `<details>` whose summary is `Advanced`, collapsed, immediately above the button row. The gitignore checkbox stays outside and still shows the pattern for the current prefix. An invalid prefix disables `Initialize` and the reason stays outside the disclosure, so a collapsed Advanced does not hide it.

## Risks / Trade-offs

- [A disabled inline command is omitted, so the muted explosion is its own command] → The tooltip is the command title. Activating it does not call `implode`. `main` contributes no implode command. The React row can still disable the button on a dirty variant.
- [Startup calls adoption, so a missing config file reads the environment] → One shared call. `active` skips it. `none` with an error stays collapsed and the notice still offers Trust.
- [Green depends on the theme] → `charts.green` plus a fallback, and the filled shape plus the tooltip (and the React label) carry the state without colour.
- [Pinning `main` changes browser order] → Intended. The browser does not gain a synthetic row.
- [`up` no longer offers play on the row] → Stop, then play. The watch command itself is unchanged.
- [Disabled explosion removes the click that used to surface the merge error] → The tooltip says implode would fail. No force action is added.
- [Local `createdAt` has no offset, so another timezone reads a different instant] → The writer and the sorter are the same machine. The text stays the form that was requested.
- [Variants created before this field have no `createdAt`] → Created sort uses the directory creation time. `create` again fills the field only when it is absent, and does not invent a time for a file that already has one.

## Migration Plan

No setting values change. A `variants.local.yaml` without `createdAt` or `startedAt` still loads; `create` fills `createdAt` only when it is absent, and the next `up` or `watch` writes `startedAt`. Ship the section and the app together so the panel does not keep the old icons for a release. Rollback is reverting the change; `variant.sort` values already in user settings stay valid. Existing `createdAt` text in `.cache/variants/*.yaml` is untouched.
