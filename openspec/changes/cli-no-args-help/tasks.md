## 1. Regression Test

- [ ] 1.1 Add a CLI subprocess test proving `variant` exits successfully and matches `variant --help` output without invoking a lifecycle command; verify the new test fails before the implementation change.

## 2. CLI Implementation

- [ ] 2.1 Normalize an empty top-level CLI argument list to the existing help path before client creation or command execution; verify the no-argument regression test passes.

## 3. Validation

- [ ] 3.1 Run the `variant-api` CLI test suite and verify existing command smoke tests plus no-argument help coverage pass.
- [ ] 3.2 Run repository-scoped lint, typecheck, and build checks for changed files; verify no new diagnostics are reported.
