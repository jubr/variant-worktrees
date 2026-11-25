## Context

See proposal.md for motivation. The publish job already has `environment: marketplace` and `id-token: write` (granted for Open VSX), and runs `bunx` tools after `jdx/mise-action` installs `bun`. The Marketplace step sets `VSCE_PAT` and runs `vsce@2.32.0 publish --packagePath`. The VS Code publishing guide ("Publish with GitHub Actions and Trusted Publishing") runs `vsce publish --oidc` in a job with `id-token: write`. The policy fields are repository owner, repository, workflow file name and optional environment; the policy for this repository names `publish-extensions.yaml` and `marketplace`.

`vsce` has `--oidc` since 4.0.0 (absent in 3.9.x). It conflicts with `--pat`, and `--pat` defaults to the `VSCE_PAT` environment variable, so the step must not set that variable. The credential lives 15 minutes and each GitHub OIDC token is exchangeable once; each matrix job requests its own.

## Goals / Non-Goals

**Goals:**
- Marketplace publication with no stored credential, one OIDC exchange per matrix job.
- Delete dead commented-out Entra lines so the workflow shows one route per registry.

**Non-Goals:**
- Changing `vsce` in `packages/*` (it only packages; the pin is local to the workflow).
- Changing Open VSX, triggers, concurrency or the matrix.

## Decisions

- **`bunx @vscode/vsce@4.1.1 publish --oidc --packagePath "$FILE"`**, pinned like `ovsx@1.3.0`. Alternative: `npx`; rejected, the job installs `bun` only and `bunx` is already used for `ovsx`.
- **No `VSCE_PAT` in the step `env`.** `--oidc` and `--pat` conflict and the env var feeds `--pat`; a leftover secret would fail the command.
- **Keep `id-token: write` at job level.** Already the only place; no workflow-level grant.
- **Drop the Entra lines** instead of keeping them commented. Alternative: keep as fallback; rejected, dead config invites drift and the policy route is the documented recommendation for GitHub Actions.
- **Spec** loses the `VSCE_PAT` clause and states both registries use trusted publishing.

## Risks / Trade-offs

- [`vsce` 4.x needs Node >= 22 and `bunx` runs it with the runner's `node`] → the first dispatch of the workflow is the verification; if the runner's Node is older, add `node` to the `mise-action` `install_args`.
- [Policy mismatch (workflow name, environment, owner) makes the token exchange fail] → the failure happens before any upload; the error names the exchange. Correct the policy, re-dispatch.
- [A private repository policy activates only on the first successful run within 48 hours] → irrelevant for a public repository; noted in the task.
- [The workflow cannot be proven by a unit test] → `task lint:workflows` (actionlint) plus a real dispatch for a released tag.

## Migration Plan

1. Merge the workflow change.
2. Dispatch `publish-extensions.yaml` for the latest tag with registry `marketplace` (a republish of the same version is refused by the Marketplace after authentication, which still proves the exchange; or wait for the next release).
3. Delete `VSCE_PAT` from the `marketplace` environment.

Rollback: restore the `VSCE_PAT` env and `vsce@2.32.0` step from git history; the secret must still exist, so delete it only after step 2 succeeded.
