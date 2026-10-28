## 1. Workflow

- [x] 1.1 Switch `.github/workflows/publish-extensions.yaml` Open VSX to `--trusted-publishing` and grant `id-token: write` on the publish job only; keep `VSCE_PAT` for the Marketplace, with the `azure/login` and `--azure-credential` lines commented out beside a link to microsoft/vsmarketplace#1422. Verify `task lint:workflows` passes.
- [x] 1.2 Update `CONTRIBUTING.md` one-time setup.

## 2. Registry setup (maintainer, outside the tree)

- [x] 2.1 On open-vsx.org register a trusted publisher per extension (`variant-worktrees`, `chat-renamer`): workflow `publish-extensions.yaml`, environment `marketplace`. Each extension needs one version already published with a token.
- [x] 2.2 Dispatch once for a release; then delete `OVSX_PAT`.

## 3. When the Marketplace supports trusted publishing

- [ ] 3.1 Enable the commented-out lines (set `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` on `marketplace`, federated credential, publisher membership), delete `VSCE_PAT`, and update the spec requirement.
