## Why

`publish-extensions.yaml` publishes with long-lived `VSCE_PAT` and `OVSX_PAT` secrets. Azure DevOps retires global PATs on 2026-12-01, and a stored token can publish anything its owner can. Both registries now accept short-lived OIDC credentials from GitHub Actions: Open VSX trusted publishing and Microsoft Entra workload identity federation.

## What Changes

- The publish job gets `id-token: write` (that job only).
- Visual Studio Marketplace: `azure/login` with a federated Entra managed identity, then `vsce publish --azure-credential`. Client, tenant and subscription IDs are environment variables, not secrets.
- Open VSX: `ovsx publish --trusted-publishing`, no token. Needs a trusted publisher registered per extension for `publish-extensions.yaml` and environment `marketplace`.
- `VSCE_PAT` and `OVSX_PAT` are no longer used and can be deleted.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meta/release-artifacts`: "Manual registry publication" replaces "credentials only from repository secrets" with "no long-lived registry tokens; OIDC credentials only".

## Impact

- `.github/workflows/publish-extensions.yaml`, `CONTRIBUTING.md` (one-time setup).
- Registry-side setup outside the tree: Entra managed identity + federated credential + Marketplace publisher membership; Open VSX trusted publisher registrations. The first version of an extension on Open VSX must already exist (published once with a token).
