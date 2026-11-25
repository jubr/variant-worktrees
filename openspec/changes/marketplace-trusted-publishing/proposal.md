## Why

`publish-extensions.yaml` still publishes to the Visual Studio Marketplace with the long-lived `VSCE_PAT` secret. Global Azure DevOps Personal Access Tokens retire on 2026-12-01, and the Marketplace now supports trusted publishing from GitHub Actions (OIDC, no stored credential). A trusted publishing policy for this workflow exists on the Marketplace publisher, so the workflow can drop the PAT.

## What Changes

- Visual Studio Marketplace: `vsce publish --oidc`, no token. The policy names `publish-extensions.yaml` and environment `marketplace`.
- The `VSCE_PAT` secret is no longer referenced and can be deleted from the `marketplace` environment.
- The commented-out Entra workload identity variant (`azure/login`, `--azure-credential`, `AZURE_*` variables) and the link to the former Marketplace limitation are removed: the route is superseded.
- The pinned `vsce` moves to a release that has `--oidc`.
- `CONTRIBUTING.md` one-time setup and the release workflow comments describe the Marketplace policy instead of the PAT.
- Non-goals: no change to Open VSX publication, to the triggers, the tag resolution, or the matrix of registry × file.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meta/release-artifacts`: "Manual registry publication" authenticates to both registries through trusted publishing, with no stored registry token.

## Impact

- `.github/workflows/publish-extensions.yaml`, `CONTRIBUTING.md` (one-time setup), `CHANGELOG.md`.
- Registry-side setup outside the tree: the Marketplace trusted publishing policy (exists) and deletion of `VSCE_PAT`.
