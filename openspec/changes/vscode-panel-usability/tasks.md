## 1. Adoption (variant-config)

- [ ] 1.1 Add failing tests for every scenario of "Adoption of a directory" in `packages/variant-config` (active skips the environment, parent lookup, each label, `none`, environment failure carried on the result)
- [ ] 1.2 Move `detectOnboarding` into `getVariantsAdoption`, stop exporting `detectOnboarding` and `OnboardingDetection`, and verify the adoption scenarios plus that the package export list has `getVariantsAdoption` and not `detectOnboarding`

## 2. Created time (variant-config, variant-api)

- [ ] 2.1 Accept `runtime.createdAt` and `runtime.watches.<key>.startedAt` as `YYYY-MM-DD_HH:MM:SS` on `variants.local.yaml`, update `variants.local.example.yaml` and the generated JSON schema, and verify every scenario of "Local runtime state" including a rejected bad timestamp
- [ ] 2.2 Make `create` write `variants.local.yaml` in the variant directory with local `runtime.createdAt`, leave an existing value, and verify "Local created time", "Created time kept", and the existing create scenarios
- [ ] 2.3 Make `up` and `watch` write `pid`, `startedAt` and `url` on each started watch and keep `runtime.createdAt`, and verify "Start time written", "Created time kept", and the existing runtime-recording scenarios
- [ ] 2.4 Set `list` `createdMs` from `runtime.createdAt` read as local time, fall back to the directory creation time when the value is missing or ill-formed, keep `changedMs` as the later modification time, and verify "Created and changed times", "No local file" and "Ill-formed created time"
- [ ] 2.5 Return `createdAt` and `startedAt` from `status` and verify "Created and start times"

## 3. Shared rows (variant-ui)

- [ ] 3.1 Pin `main` first in `sortVariants` and verify the ordering scenarios of "Variant rows and states", including no invented `main` row and the UI server staying above
- [ ] 3.2 Switch row state icons to a hollow dot, a filled green watching dot, and a different up shape, with the text label kept, and verify the watching, up, down, and stale scenarios
- [ ] 3.3 Show exactly one run control (play when `down`, square stop when `watching` or `up`). Show no implode control on `main`. On every other row show the explosion, muted and disabled when `implodeClean` is false, and verify every scenario of "Controls per state" including keyboard access and the pending row
- [ ] 3.4 Leave the Explorer on the native tree. The React rows keep the full layout and their always-visible controls. Explorer icons and Create variant are section 4


## 4. Explorer section (variant-vscode)

- [ ] 4.1 Set the section's initial visibility to `collapsed` and expand on startup when `getVariantsAdoption()` is `active` or `detected` and `variant.autoExpand` is not `false`. `none` does not expand. Verify the default, collapsed-again, setting-off, detected, and none scenarios. `active` does not read the environment; `detected` and `none` do, through that one call
- [ ] 4.2 When a config file exists and the library returns no `main` record, prepend a `down` non-implodable `main` record in the extension store only, and verify "Main with no state file" plus that a CLI `list` of the same records does not gain `main`
- [ ] 4.3 Keep `variant.variants` a tree view. Show the not-initialized introduction with `Onboard` running `variant.onboardingInit` when no config file is found, keep the onboarding webview swap, and verify "No configuration", "Onboard opens the dialog", and "No folder"
- [ ] 4.4 Contribute the Sort submenu per `variant.currentSort` with the arrow labels, the `Sort: …` tooltip, and a check on the selected item, and verify the menu placement, tooltip, check, and "Setting from the menu" scenarios
- [ ] 4.5 Contribute play, square stop and the explosion as native inline actions (hover or selection). `main` contributes no implode command. A row with `implodeClean` false contributes the muted explosion, whose title is the tooltip, and activating it does not implode. Wire them to the existing watch, down and implode actions (confirmation, progress, log lines) and verify the inline-action scenarios against `mocks/vscode.ts`
- [ ] 4.6 Put Create variant (`$(add)`) in the view title immediately left of Sort. Activating it opens `createInputBox` titled `Create variant`. Accepting a slug runs `create` and the section reloads so the new row is listed. An empty value and a dismiss leave the list unchanged. Verify the button order and those three outcomes against `mocks/vscode.ts`

## 5. Onboarding dialog and notice

- [ ] 5.1 Move `Prefix` into a collapsed `Advanced` disclosure immediately above the buttons, label the confirm button `Initialize`, keep an invalid-prefix reason outside the disclosure, and verify every scenario of "Onboarding command and dialog"
- [ ] 5.2 Drive the one-time notification from `getVariantsAdoption` only (`active` skips it, `detected.label` is the sentence, `none` with an error offers Trust) and verify every scenario of "One-time onboarding notification"

## 6. Documentation and verification

- [ ] 6.1 Update the repository README, `packages/variant-vscode/README.md`, `docs/guide/core.md`, and `CHANGELOG.md` where they describe section startup, sort labels, the trash icon, the Init button, or created order, and verify those passages name `Onboard`, `Initialize`, the arrow labels, the pinned `main` row, the explosion control, and `runtime.createdAt` (`YYYY-MM-DD_HH:MM:SS`) as the created sort key
- [ ] 6.2 Run `task lint`, `task test`, `task build`, and `mise x -- openspec validate --all --strict --no-interactive`, and fix findings
