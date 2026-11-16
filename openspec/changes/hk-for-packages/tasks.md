## 1. hk 2.x pin

- [x] 1.1 Bump `hk` to 2.8.0 in `mise.toml` and move the `amends`/`import` URLs in `hk.pkl` to `hk@2.8.0`. Verify `mise x -- hk --version` prints 2.8.0 and `task check:changed` still runs.

## 2. Contract test and shared package configuration

- [x] 2.1 Add failing `scripts/hk-config.spec.ts` for [specs/meta/local-checks](../../specs/meta/local-checks/spec.md): every `packages/*/package.json` directory has an `hk.pkl` and appears in the plan; `hk check --all --plan` selects one Biome step per package and none without a package; `--profile ci` selects one `test` step per package; the default, `ci`, `full` and pre-commit plans select the steps named in the spec; a staged `packages/variant-api/src/index.ts` selects only the `variant-api` Biome step. Verify the new tests fail.
- [x] 2.2 Add root `hk.package.pkl` with the shared Biome step and the `check`, `fix` and `pre-commit` hooks, plus the shared `test` step (`bun run test`, `ci` profile, `depends` on `build`), and one-line `packages/<name>/hk.pkl` for all twelve packages. Verify the package tests from 2.1 pass.
- [x] 2.3 Set `subprojects = List("packages/*")` in the root `hk.pkl`, remove the root Biome step and the root `test` step, add `test:scripts` (`bun test scripts`, `ci`, depends on `build`), keep commitlint, `build`, `docs:build` and the hook-wide `fix`/`stash`/`commit-msg`. Verify the profile and pre-commit tests from 2.1 pass.
- [x] 2.4 Run `hk check --all` over a deliberately mis-formatted `.ts` file in two packages and verify both are reported by their package step; discard the edits. Run `hk run pre-commit` on a staged file and verify it passes.
- [x] 2.5 Run `hk check --all --profile ci` and verify from the output that no package `test` starts before `build` finishes and that the package tests overlap in time; verify all pass without interference between packages.
- [x] 2.6 A concurrent run failed the `variant-cli` zsh completion prefetch test: the driver counted stub starts without waiting for the background gathering. Make `drive.zsh` wait for each expected start and for the remembered list, make the stub able to start late, and run the prefetching shells with a late stub. Verify the zsh driver fails with the old wait and `bun test src/completions-shells.spec.ts` passes in all three shells.
- [ ] 2.7 A concurrent run failed the `variant-api` implode test `fails after the worktree is gone when the branch is checked out elsewhere` (implode resolved). Find the cause, fix it in the product or the test, and verify the test passes under concurrent package runs.
- [x] 2.8 Move the workflow lint and the extension packaging into hk. Add failing tests: `scripts/hk-config.spec.ts` for the plans in [specs/meta/local-checks](../../specs/meta/local-checks/spec.md), and `scripts/ci-feature-builds.spec.ts` that `ci-branch.yaml` runs neither `task lint:workflows` nor `task package:vsix`. Then add the `lint:workflows` (`ci`) and `package:vsix` (`full`, depends on `build`) steps and `task package:vsix:pack`, and drop the two workflow steps. Verify the new tests pass, `task package:vsix` still builds then packages, and `task check:full` leaves two `.vsix` files in `out/`.
- [x] 2.9 CI failed on a clean checkout: `docs:build` rebuilt package `dist/` beside the tests that read it. Add a failing plan test that `docs:build` and `package:vsix` depend on `build`; run `task docs:site` (no rebuild) after `build`; make `scripts/docs-site.spec.ts` use `docs:site` when the packages are built. Also make the omitted-create install test wait on a release file instead of a 0.3s sleep.

## 3. Tasks and docs

- [x] 3.1 Rewrite the `desc` of `check:changed`, `check:all`, `check:full` in `Taskfile.yaml` for the nested layout. Verify `task --list` shows all three and `task check:all` runs no install.
- [x] 3.2 Update `CONTRIBUTING.md` (nested `hk.pkl` layout, shared module, profiles `ci`/`full`, the three tasks, how to add a package) and the hk section of `AGENTS.md`. Verify the three task names and `hk.package.pkl` appear in both.

## 4. Gates

- [x] 4.1 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive` and `task check:full`. Verify each passes.
