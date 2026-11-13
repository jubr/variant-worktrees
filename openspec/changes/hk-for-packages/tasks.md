## 1. hk 2.x pin

- [ ] 1.1 Bump `hk` to 2.8.0 in `mise.toml` and move the `amends`/`import` URLs in `hk.pkl` to `hk@2.8.0`. Verify `mise x -- hk --version` prints 2.8.0 and `task check:changed` still runs.

## 2. Contract test and shared package configuration

- [ ] 2.1 Add failing `scripts/hk-config.spec.ts` for [specs/meta/local-checks](../../specs/meta/local-checks/spec.md): every `packages/*/package.json` directory has an `hk.pkl` and a root `subprojects` entry; `hk check --all --plan` selects one Biome step per package and none without a package; the default, `ci`, `full` and pre-commit plans select the steps named in the spec; a staged `packages/variant-api/src/index.ts` selects only the `variant-api` Biome step. Verify the new tests fail.
- [ ] 2.2 Add root `hk.package.pkl` with the shared Biome step and the `check`, `fix` and `pre-commit` hooks, and one-line `packages/<name>/hk.pkl` for all twelve packages. Verify the package tests from 2.1 pass.
- [ ] 2.3 Set `subprojects` in the root `hk.pkl`, remove the root Biome step, keep commitlint, `test`, `build`, `docs:build` and the hook-wide `fix`/`stash`/`commit-msg`. Verify the profile and pre-commit tests from 2.1 pass.
- [ ] 2.4 Run `hk check --all` over a deliberately mis-formatted `.ts` file in two packages and verify both are reported by their package step; discard the edits. Run `hk run pre-commit` on a staged file and verify it passes.

## 3. Tasks and docs

- [ ] 3.1 Rewrite the `desc` of `check:changed`, `check:all`, `check:full` in `Taskfile.yaml` for the nested layout. Verify `task --list` shows all three and `task check:all` runs no install.
- [ ] 3.2 Update `CONTRIBUTING.md` (nested `hk.pkl` layout, shared module, profiles `ci`/`full`, the three tasks, how to add a package) and the hk section of `AGENTS.md`. Verify the three task names and `hk.package.pkl` appear in both.

## 4. Gates

- [ ] 4.1 Run `task lint`, `task test`, `task build`, `openspec validate --all --strict --no-interactive` and `task check:full`. Verify each passes.
