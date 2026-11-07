## 1. Failing workflow contract

- [x] 1.1 Add `scripts/packslip-workflow.spec.ts` that parses `.github/workflows/packslip.yaml` and `.github/workflows/ci-release.yaml` for [specs/meta/release-artifacts | Signed release bundle](../../specs/meta/release-artifacts/spec.md#requirement-signed-release-bundle), the checksum exclusion in [specs/meta/release-artifacts | Release contents](../../specs/meta/release-artifacts/spec.md#requirement-release-contents), and [specs/meta/ci-feature-builds | Workflow actions run on the supported Node runtime](../../specs/meta/ci-feature-builds/spec.md#requirement-workflow-actions-run-on-the-supported-node-runtime). The test fails unless `packslip.yaml` is `workflow_call` and `workflow_dispatch` with a required `tag` input, has no workflow-level permissions, runs both jobs only on `refs/heads/main`, pins `jdx/packslip`, `actions/upload-artifact`, and `actions/download-artifact` to full commits, gives the signing job `contents: read`, `id-token: write`, and `attestations: write` with `upload: false` and no `token` input, downloads the six versioned executable names rather than a `variant-*` glob, sets `bin: variant`, and gives only the following job `contents: write` for an upload of `packslip.sigstore.json` to `inputs.tag` with `--clobber`. It fails unless `ci-release.yaml` calls `./.github/workflows/packslip.yaml` after the release job, passes `v` plus the resolved version, grants `contents: write`, `id-token: write`, and `attestations: write`, and skips the call unless that release job succeeded, the tag does not already exist, the ref is `main`, and the run is not a dry run. It fails unless every other workflow still pins `actions/upload-artifact` to `@v7` and `actions/download-artifact` to `@v8`. The build job still writes `SHA256SUMS` before the release is created, and the signing call stays after that release. Run `bun test scripts/packslip-workflow.spec.ts` and see it fail.

## 2. Reusable workflow

- [x] 2.1 Add `.github/workflows/packslip.yaml` as design.md describes. Pin `jdx/packslip` to the full commit of the latest published release at or after `v1.11.3` (commit `44e50e5f64551234b4a382d991bd7f7f7d021d06` is the floor). Pin `actions/upload-artifact` and `actions/download-artifact` to the full commits of majors `v7` and `v8`. Check that pinned action against the six bare names and pass `formats` for every name it does not infer. Verify `bun test scripts/packslip-workflow.spec.ts` fails only on the missing `ci-release.yaml` call, and `task lint:workflows` passes.

## 3. Release wiring

- [x] 3.1 Call `packslip.yaml` from `.github/workflows/ci-release.yaml` with the `if`, `needs`, `with.tag`, and permissions in design.md. Verify `bun test scripts/packslip-workflow.spec.ts` passes and `task lint:workflows` passes.

## 4. Docs

- [x] 4.1 In the Releasing section of `CONTRIBUTING.md`, say the release workflow calls `packslip.yaml` after it creates the release, the signing job has `contents: read`, and a failed sign is retried by dispatching `packslip.yaml` from `main` with the tag, then `publish-extensions.yaml` if registry publication was skipped. Add an `Unreleased` note in `CHANGELOG.md`. Do not invent a signer fingerprint. Verify those sentences are present.

## 5. Validation

- [x] 5.1 Run `bun test scripts/packslip-workflow.spec.ts`, `task lint:workflows`, and `openspec validate --all --strict --no-interactive`. All three pass.
