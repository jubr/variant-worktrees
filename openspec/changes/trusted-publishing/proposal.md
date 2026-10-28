## Why

`publish-extensions.yaml` publishes with long-lived `VSCE_PAT` and `OVSX_PAT` secrets. Open VSX now accepts short-lived OIDC credentials from GitHub Actions (trusted publishing), so `OVSX_PAT` can go. The Visual Studio Marketplace cannot yet: its trusted publishing is not supported by the backend (https://github.com/microsoft/vsmarketplace/issues/1422), and the Entra workload-identity route needs an Azure subscription. Global Azure DevOps PATs retire on 2026-12-01, so the workflow keeps the Entra route ready but disabled.

## What Changes

- Open VSX: `ovsx publish --trusted-publishing`, no token. Needs a trusted publisher registered per extension for `publish-extensions.yaml` and environment `marketplace`.
- The publish job gets `id-token: write` (that job only).
- Visual Studio Marketplace: stays on `VSCE_PAT`. The Entra variant (`azure/login` + `vsce publish --azure-credential`, with `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`) is left as commented-out lines in the workflow, with a link to the Marketplace issue.
- `OVSX_PAT` is no longer used and can be deleted.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meta/release-artifacts`: "Manual registry publication" replaces "credentials only from repository secrets" with "Open VSX through trusted publishing, Visual Studio Marketplace through the `VSCE_PAT` secret".

## Impact

- `.github/workflows/publish-extensions.yaml`, `CONTRIBUTING.md` (one-time setup).
- Registry-side setup outside the tree: Entra managed identity + federated credential + Marketplace publisher membership; Open VSX trusted publisher registrations. The first version of an extension on Open VSX must already exist (published once with a token).
