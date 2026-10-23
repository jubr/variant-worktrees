## 1. Publish workflow

- [x] 1.1 Reorder the `publish` job in `.github/workflows/publish-extensions.yaml` so `actions/checkout` and mise setup precede `actions/download-artifact`, per [specs/meta/release-artifacts | Manual registry publication](../../specs/meta/release-artifacts/spec.md#requirement-manual-registry-publication). Verify the step order in the file and `task lint:workflows` passes.
- [x] 1.2 Add a guard step before the first registry step that fails with `::error::` when `vsix/*.vsix` matches no file. Verify by running the guard's shell snippet locally in an empty and a populated `vsix/` directory, and `task lint:workflows` passes.

## 2. Verification

- [x] 2.1 Run `openspec validate --all --strict --no-interactive` and `task check:full`; verify both pass.
- [ ] 2.2 After merge, dispatch `publish-extensions.yaml` for the latest release tag with a single registry and verify the publish job finds the `.vsix` files.
