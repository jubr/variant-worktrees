## 1. Adoption (variant-config)

- [ ] 1.1 Add failing tests for every scenario of "Adoption of a directory" in `packages/variant-config` (active skips the environment, parent lookup, each label, `none`, environment failure carried on the result)
- [ ] 1.2 Export `getVariantsAdoption` beside `detectOnboarding`, using the `findConfigFile` lookup for `active`, and verify those tests pass

## 2. Shared rows (variant-ui)

- [ ] 2.1 Pin `main` first in `sortVariants` and verify the ordering scenarios of "Variant rows and states", including no invented `main` row and the UI server staying above
- [ ] 2.2 Switch row state icons to a hollow dot, a filled green watching dot, and a different up shape, with the text label kept, and verify the watching, up, down, and stale scenarios
- [ ] 2.3 Show exactly one run control (play when `down`, square stop when `watching` or `up`) and an explosion implode control that is dimmed, disabled, and still named when the row is `main` or `implodeClean` is false, and verify every scenario of "Controls per state" including keyboard access and the pending row
- [ ] 2.4 Add the compact presentation (dot, slug, uptime, run control, explosion control, no URL or state sentence) for the Explorer host, and verify a compact render stays visible without hover and a full render still shows the URL and state label

## 3. Explorer section (variant-vscode)

- [ ] 3.1 Set the section's initial visibility to `collapsed` and expand on startup only when the config-file lookup hits and `variant.autoExpand` is not `false`, and verify the default, collapsed-again, setting-off, and no-config scenarios without an environment read
- [ ] 3.2 When a config file exists and the library returns no `main` record, prepend a `down` non-implodable `main` record in the extension store only, and verify "Main with no state file" plus that a CLI `list` of the same records does not gain `main`
- [ ] 3.3 Host the compact app in the `variant.variants` webview, keep the onboarding view swap, show the not-initialized introduction with `Onboard` running `variant.onboardingInit` when no config file is found, and verify "No configuration", "Onboard opens the dialog", and "No folder"
- [ ] 3.4 Contribute the Sort submenu per `variant.currentSort` with the arrow labels, the `Sort: …` tooltip, and a check on the selected item, and verify the menu placement, tooltip, check, and "Setting from the menu" scenarios
- [ ] 3.5 Wire compact play, square stop, and explosion to the existing watch, down, and implode actions (confirmation, disabled control does nothing, progress, log lines) and verify the inline-action scenarios against `mocks/vscode.ts`

## 4. Onboarding dialog and notice

- [ ] 4.1 Move `Prefix` into a collapsed `Advanced` disclosure immediately above the buttons, label the confirm button `Initialize`, keep an invalid-prefix reason outside the disclosure, and verify every scenario of "Onboarding command and dialog"
- [ ] 4.2 Drive the one-time notification from `getVariantsAdoption` and verify every scenario of "One-time onboarding notification", including Trust when the result carries an environment failure

## 5. Documentation and verification

- [ ] 5.1 Update the repository README, `packages/variant-vscode/README.md`, `docs/guide/core.md`, and `CHANGELOG.md` where they describe section startup, sort labels, the trash icon, or the Init button, and verify those passages name `Onboard`, `Initialize`, the arrow labels, the pinned `main` row, and the explosion control
- [ ] 5.2 Run `task lint`, `task test`, `task build`, and `mise x -- openspec validate --all --strict --no-interactive`, and fix findings
