## 1. Summary script

- [x] 1.1 Red then green in `scripts/slim-summary.spec.ts`: `slimSummary` renders the table with the release, the runtime KB and the `variant` KB, shows `–` for a missing release or runtime, and a run of the script on a temporary cache and executable prints it. Verify `bun test scripts/slim-summary.spec.ts` passes.

## 2. Workflow

- [x] 2.1 Red then green in `scripts/ci-feature-builds.spec.ts`: the `node-smoke` job runs `bun scripts/slim-summary.ts` after the smoke test, appends to `$GITHUB_STEP_SUMMARY`, and the step has `continue-on-error: true`. Add the step to `.github/workflows/ci-branch.yaml` and name it in `CONTRIBUTING.md`. Verify `bun test scripts` and `task lint:workflows` pass.
- [x] 2.2 Task-group commit (`ci: ...`) with the code and tests of 1.1 and 2.1, and `openspec validate --all --strict --no-interactive` passes.
