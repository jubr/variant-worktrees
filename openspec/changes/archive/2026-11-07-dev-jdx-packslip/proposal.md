## Why

A GitHub Release of `variant` is a set of bare executables plus a checksum file. Nothing on that release states who built those bytes, so a user or Mise cannot pin a signer. Packslip can sign the release with the workflow's identity, but the action must not hold a token that can change the release.

## What Changes

- Add `.github/workflows/packslip.yaml`, one reusable workflow for every signature. It signs the six `variant` executables of a published release in a job with `contents: read` and `upload: false`, then a second job with `contents: write` uploads only `packslip.sigstore.json`.
- The release workflow calls that workflow after it creates `v<version>`, and passes the tag. A dry run and a version whose tag already exists do not call it. The same workflow can be dispatched by hand for one tag, so a release that was created but not signed is signed from the same file.
- The checksum file still covers the built assets. It does not list the bundle, which is attached after the checksum is written.
- `jdx/packslip` and the artifact upload and download actions inside the new workflow are pinned to full commits. Other workflows keep their major-version pins.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `meta/release-artifacts`: a release created by the release workflow also carries `packslip.sigstore.json` for the six `variant` executables. The job that runs the action cannot change the release. The checksum file covers the built assets and not the bundle.
- `meta/ci-feature-builds`: an action may be pinned to the full commit of a Node.js 24 major, or of a composite action, in addition to a major-version tag.

## Impact

- New `.github/workflows/packslip.yaml`. `.github/workflows/ci-release.yaml` calls it after the publish job.
- `CONTRIBUTING.md` and `CHANGELOG.md` record the signed bundle and the two-job split.
- A test reads those workflow files and checks the permissions, `upload: false`, the download patterns, and the call from the release workflow. `task lint:workflows` covers syntax.
- Release asset names, platforms, `.vsix` publication, and the release trigger stay as they are.

## Non-goals

- Wrapping the executables in archives, or renaming them.
- Signing the `.vsix` files, `SHA256SUMS`, or the feature-branch pre-release binary.
- Publishing a signer fingerprint. That exists only after the first signed release.
- Moving the release trigger onto tag pushes.
- Setting `attest` to `false` or `link`. Build jobs do not attest today, so the signing job attests.
