## Context

`variant.baseBranch` is optional in the schema and resolves to `DEFAULT_BASE_BRANCH` (`main`) in `resolveVariant` of `variant-config`, the one place every command, the library, the MCP tools and the editor resolve the configuration. `variant-api` uses the resolved value as the start of a new variant branch and as the merge base of `implode`. `autodetect.ts` already holds the other autodetection (`detectVariantPlace` runs `git rev-parse --git-common-dir`, plus database, abbreviation, watches), and `variant config` prints a `# autodetect from ...` comment per detected value. `renderInitConfig` builds the `variants.yaml` of `init` from the same detectors. See proposal.md for the failure this fixes.

## Goals / Non-Goals

**Goals:**

- A project on `master`, `develop` or any other default branch works with every command, with or without a `variants.yaml`, and after `variant init` the choice is visible in the file.
- Detection is offline, fast and side-effect free.
- One detector for the runtime default and for `init`, so they cannot disagree.

**Non-Goals:**

- Fetching, `git remote set-head`, or any change to a repository.
- Choosing between several plausible branches interactively.
- Detecting anything for a configured `variant.baseBranch`.

## Decisions

- **One detector in `variant-config/src/autodetect.ts`**: `detectDefaultBranch(directory)` returns `{ branch, via } | undefined`, beside `detectVariantPlace`, which has the same shape (`via` names the signal). `resolveVariant` uses it for the default (`variant.baseBranch ?? detected?.branch ?? DEFAULT_BASE_BRANCH`) on the resolved `main`; `renderInitConfig` uses it for the written value and its comment; the origins of `variant config` use `via` for its comment. Alternative: detection in `variant-api` next to `worktree.ts`. Rejected: resolution and `renderInitConfig` are in `variant-config`, which `variant-api` depends on, not the other way round.
- **Signal order: `origin/HEAD`, `init.defaultBranch`, `main`, `master`, checked out.** `origin/HEAD` is what the hosting service calls the default and is the only signal that is right for `develop` or `trunk` in a clone. `init.defaultBranch` is the person's own statement for local repositories, but only counts when that branch exists, since the setting is global and may not describe this repository. `main` before `master` matches current git and hosting defaults. The checked-out branch is last, since a feature branch is checked out as often as a default one. It still stays a signal: when it is reached no local `main` exists, so the old default `main` would fail anyway, and for a repository without commits the unborn branch is exactly what the first commit creates.
- **Plain git commands, no network.** `git symbolic-ref --short refs/remotes/origin/HEAD` (strip the leading `origin/`), `git config --get init.defaultBranch`, `git show-ref --verify --quiet refs/heads/<name>`, `git symbolic-ref --short HEAD`, each `git -C <main checkout>`. Alternative: `git ls-remote --symref origin HEAD` is always current but needs network and credentials; rejected. A stale `origin/HEAD` is fixed by `git remote set-head origin -a`, which the docs mention.
- **Remote head is trusted even without a local branch.** `origin/HEAD` names the remote default whether or not a local branch exists yet; it is used as given.
- **Runs only when the setting is unset.** A configured value is used without running git, so the cost (one to five short `git` calls, usually the first answers) is only paid by files that leave it out. The result is not cached across loads, so a branch made or a remote head changed is seen by the next command.
- **Directory is the main checkout.** `resolveVariant` has `variant.main`; `init` runs in the main checkout (see the onboarding requirement of `variant-vscode`). The checked-out signal in a linked worktree would name that worktree's branch; it is the last signal and an accepted edge.
- **`init` writes it, also when it is `main`.** The user asked for the detected value to be written, the file then shows the choice commands use, and it keeps working if the repository's branches are renamed later. A value equal to the default costs one line.
- **Comment names the signal**, like the `# from ../mise.local.toml` comments of secrets, so a person can see why and change it. `variant config` uses the same words.
- **`DEFAULT_BRANCH_SETTINGS` in `worktree.ts`** is only the fallback parameter of the worktree function when a caller passes no settings. Callers go through the resolved configuration; the task list checks that and keeps `main` there only if no production caller relies on it.

## Risks / Trade-offs

- [`origin/HEAD` missing in clones made with `git init` + `git remote add`] → falls through to `init.defaultBranch`, `main`, `master`, checked out; docs name `git remote set-head origin -a`.
- [Repository with both `main` and `master` and no `origin/HEAD`] → `main` wins; set `variant.baseBranch` to choose otherwise, and `variant config` shows what was detected.
- [Detached `HEAD` in a repository with no candidate] → `main` applies and the failure of the issue can still occur; accepted, it is rare.
- [Stale `origin/HEAD` after a remote rename] → used as is; same fix as above.
- [Behavior change for existing files without `baseBranch`] → they resolved to `main` before; they now resolve to the detected branch, which differs from `main` only when the repository's default is another branch. In a repository whose `origin/HEAD` is `develop`, `implode` now checks the merge against `develop`. Noted in the changelog; set `variant.baseBranch: main` to keep the old value.
- [Extra `git` calls on every config load] → short calls on a local repository, skipped when the value is configured.
