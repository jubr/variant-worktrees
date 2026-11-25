## 1. Workflow

- [x] 1.1 In `.github/workflows/publish-extensions.yaml` replace the Marketplace step with `bunx --bun @vscode/vsce@4.1.1 publish --oidc --packagePath "$FILE"` without `VSCE_PAT`, delete the commented-out Entra lines, and fix the header comments; verify `task lint:workflows` passes and `rg "secrets.VSCE_PAT|azure/login|AZURE_" .github/workflows/publish-extensions.yaml` finds nothing.
- [x] 1.2 Update the `CONTRIBUTING.md` Releasing paragraph (one-time setup: Marketplace trusted publishing policy for `publish-extensions.yaml` and environment `marketplace`, no secret, no `AZURE_*` variables) and the `publish-extensions.yaml` bullet if it names the PAT; verify `rg "VSCE_PAT|AZURE_" CONTRIBUTING.md` finds nothing.
- [x] 1.3 Add a `CHANGELOG.md` entry under `## Unreleased` (add the heading when missing); verify the entry is present.

## 2. Verification

- [x] 2.1 Run `openspec validate marketplace-trusted-publishing --strict --no-interactive` and `task check:all`; both pass.

## 3. Registry setup (maintainer, outside the tree)

- [ ] 3.1 Dispatch `publish-extensions.yaml` for a released tag with registry `marketplace`; the OIDC exchange succeeds (a version-already-exists refusal after authentication also proves it).
- [x] 3.2 Delete the `VSCE_PAT` secret from the `marketplace` environment.
