## 1. Workflow

- [x] 1.1 Switch `.github/workflows/publish-extensions.yaml` to Entra federation (`azure/login`, `vsce publish --azure-credential`) and Open VSX `--trusted-publishing`; grant `id-token: write` on the publish job only. Verify `task lint:workflows` passes.
- [x] 1.2 Update `CONTRIBUTING.md` one-time setup.

## 2. Registry setup (maintainer, outside the tree)

- [ ] 2.1 Create the Entra user-assigned managed identity, add a GitHub federated credential (repo `jubr/variant-worktrees`, environment `marketplace`), add it as Contributor of Marketplace publisher `jubr`, set environment variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` on `marketplace`.
- [ ] 2.2 On open-vsx.org register a trusted publisher per extension (`variant-worktrees`, `chat-renamer`): workflow `publish-extensions.yaml`, environment `marketplace`.
- [ ] 2.3 Dispatch once for a release; then delete `VSCE_PAT` and `OVSX_PAT`.
