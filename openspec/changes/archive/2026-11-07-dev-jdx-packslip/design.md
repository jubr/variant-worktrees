## Context

See proposal.md. `.github/workflows/ci-release.yaml` runs on a push to `main`. After CI, it builds both `.vsix` files, six bare `variant-<version>-<os>-<arch>[.exe]` executables, and `SHA256SUMS`, then `gh release create v<version> --target $GITHUB_SHA` uploads those files. The run's ref is `refs/heads/main`, not the tag. Only the `release` job has `contents: write`. `publish-extensions.yaml` starts from `workflow_run` after this workflow succeeds. Requirements are [specs/meta/release-artifacts](../../specs/meta/release-artifacts/spec.md) and [specs/meta/ci-feature-builds](../../specs/meta/ci-feature-builds/spec.md).

## Goals / Non-Goals

**Goals:**

- Every signature comes from `.github/workflows/packslip.yaml`, whether the release workflow called it or a person dispatched it.
- The job that runs `jdx/packslip` has a token that can read the release and cannot change it.

**Non-Goals:**

- Creating the release as a draft.
- Attesting in the build job and passing `attest: link`.
- Publishing the signer fingerprint.

## Decisions

### One reusable workflow, two jobs

`packslip.yaml` triggers on `workflow_call` and `workflow_dispatch`, with one required string input `tag` (for example `v1.2.3`). Packslip treats the workflow file as the signer. A second file, or the same steps inlined in `ci-release.yaml`, would be a different signer.

The signing job runs `jdx/packslip` with `upload: false` and permissions `contents: read`, `id-token: write`, `attestations: write`. It does not pass `token`. The action still receives that job's `GITHUB_TOKEN`, which is why write access has to be absent from the job rather than omitted from the step. The job then uploads the bundle output as a workflow artifact named `packslip-bundle`.

The next job has permissions `contents: write` only. It downloads that artifact and runs `gh release upload` of `packslip.sigstore.json` to `inputs.tag` with `--clobber`. `--clobber` replaces that asset name. It does not replace the executables, the `.vsix` files, or `SHA256SUMS`. The upload command uses `inputs.tag`, not `github.ref_name`, because a release run's ref name is `main`.

No workflow-level `permissions` block. A workflow-level `contents: read` would stop the upload job from writing, and a workflow-level `contents: write` would give the signing job write as well. Each job sets its own permissions. On `workflow_call`, permissions can only stay the same or drop, so the caller job in `ci-release.yaml` grants the maximum: `contents: write`, `id-token: write`, `attestations: write`.

Both jobs run only when `github.ref == 'refs/heads/main'`, so a dispatch from another branch does not sign.

Alternative: one step in the existing `release` job. That job's token can change the release, and `upload: false` only skips the action's own upload.

### The release workflow calls it after the release exists

New job `packslip` in `ci-release.yaml`:

- `needs: [version, release]`
- `uses: ./.github/workflows/packslip.yaml`
- `with.tag`: `v` plus `needs.version.outputs.version`
- `if` includes `needs.release.result == 'success'`, `github.ref == 'refs/heads/main'`, `needs.version.outputs.exists == 'false'`, and not a dry run. A custom `if` replaces the implicit success check, so the release result has to be in the expression.

`github.sha` is the commit `gh release create` targeted, so the action's default `commit` stays. The tag is `v` plus a semver, so the action's default `version` stays. `project` stays the repository, which writes `packslip.sigstore.json` rather than a monorepo subpath name. `attest` stays the default `true`.

`publish-extensions.yaml` is unchanged. It still runs only after the Release workflow succeeds, so a failed signature also skips automatic registry publication. Hand dispatch of that workflow remains the way to publish the `.vsix` files of a release that already exists.

Alternative: a tag-push workflow. `gh release create` uses the workflow token, and that token does not start another workflow. The signature's ref stays `refs/heads/main`.

### Download the six executables by name, then sign them as bare binaries

Asset names are `variant-<version>-linux-x64`, `variant-<version>-linux-arm64`, `variant-<version>-darwin-x64`, `variant-<version>-darwin-arm64`, `variant-<version>-windows-x64.exe`, and `variant-<version>-windows-arm64.exe`. The signing job derives `<version>` by stripping a leading `v` from `inputs.tag`, downloads those six names into one directory, and fails if any file is missing. The action then takes `artifacts` from that directory and `bin: variant`. It does not use the `download` input: a glob such as `variant-*` also matches `variant-worktrees-<version>.vsix`, and a short match would still sign.

The release is already published, so `contents: read` can download it.

Unsuffixed names may not be inferred as format `raw`. While implementing, check the pinned action. For each of the six names it does not infer, pass `formats` as `FILENAME=raw` (or the format that action documents for `.exe`). Do not wrap the executables.

`SHA256SUMS` stays the file the build job writes before `gh release create`. The bundle is uploaded later and is not a line in it.

### Pin the actions that this workflow runs

Pin `jdx/packslip` to the full commit of a published release, never `@v1`. The floor is tag `v1.11.3`, commit `44e50e5f64551234b4a382d991bd7f7f7d021d06`: that action.yml has `download`, `upload`, and bare-executable `bin`. At implementation, pin the latest published release at or after that tag, and write the commit in the workflow.

Pin `actions/upload-artifact` and `actions/download-artifact` in this file to the full commits of the majors the other workflows already use (`v7` and `v8`). Leave those other workflows on the major tags. The nested `actions/attest-build-provenance` pin stays inside `jdx/packslip`.

## Risks / Trade-offs

- [The release exists and signing then fails. The next push sees the tag and does not sign.] → Dispatch `packslip.yaml` from `main` with that tag. Registry publication also did not run; dispatch `publish-extensions.yaml` for the same tag after the bundle is up.
- [The signature names `refs/heads/main`, not the tag. A consumer that accepts only tag runs refuses it.] → Expected with this release trigger. The fingerprint, published after the first signed release, is the pin. Do not move the trigger onto tags to change the ref.
- [A `variant-*` glob collects the variant-worktrees `.vsix`.] → Download the six versioned names and require each file.
- [Regenerating `SHA256SUMS` after the upload changes a file the bundle already digested.] → Leave the checksum file as the build job wrote it.
- [The action's attest step uses whatever Node runtime `jdx/packslip` pins.] → Feature-branch CI does not call this workflow. Do not set `attest: false` to hide an annotation.

## Migration Plan

The next release created after this lands gets the bundle in the same run. Older tags stay unsigned until someone dispatches `packslip.yaml` from `main` with that tag. Rollback is deleting the caller job and `packslip.yaml`. Bundles already uploaded stay. The following release is unsigned again.

## Open Questions

None.
