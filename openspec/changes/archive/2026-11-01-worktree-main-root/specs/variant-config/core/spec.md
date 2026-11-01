## MODIFIED Requirements

### Requirement: Variant worktree root resolution

The system SHALL resolve two directories for the `<prefix><slug>` worktrees (default prefix `_v-`): the main tree `variant.main`, the main git checkout the worktrees are made from, and the root `variant.root`, the directory that holds them. `variant.main` SHALL be the configured path, resolved relative to `variants.yaml`; else the directory of the real file that a parent `AGENTS.md` symlink targets; else the git common (carrying) directory containing the real `AGENTS.md`, or the git common root without one; else the directory of `variants.yaml`. `variant.root` SHALL be the configured path, resolved relative to `variants.yaml`; else the directory that holds a parent `AGENTS.md` symlink whose real target lies in the main tree (`<parent>/_v-foo`); else the main tree (`./_v-foo`). Both SHALL be carried, resolved, in the loaded configuration.

#### Scenario: Explicit variant root
- **WHEN** `variants.yaml` defines `variant.root`
- **THEN** the configured path, resolved relative to `variants.yaml`, is used as the worktree base

#### Scenario: Explicit variant main
- **WHEN** `variants.yaml` defines `variant.main: ../app`
- **THEN** the resolved `variant.main` is that path resolved relative to `variants.yaml`
- **AND** an absent `variant.root` is then the main tree, unless a parent `AGENTS.md` symlink targets it

#### Scenario: Parent AGENTS symlink
- **WHEN** the parent directory `/work` of `variants.yaml` contains an `AGENTS.md` symlink targeting `/work/app/AGENTS.md`, and `variant.main` and `variant.root` are absent
- **THEN** `variant.main` is `/work/app`, `variant.root` is `/work`, and the worktree of slug `foo` is `/work/_v-foo`

#### Scenario: Symlink read from a linked worktree
- **WHEN** `variants.yaml` is read from the linked worktree `/work/_v-bar` and `/work/AGENTS.md` is a symlink into the main tree `/work/app`
- **THEN** `variant.main` is `/work/app` and `variant.root` is `/work`

#### Scenario: Git carrying directory fallback
- **WHEN** `variant.main` and `variant.root` are absent and no parent `AGENTS.md` symlink exists
- **THEN** `variant.main` is the git common or carrying directory, and `variant.root` is the same directory, so the worktree of slug `foo` is `<main>/_v-foo`

#### Scenario: Symlink into another tree
- **WHEN** `variant.main` is `/work/app` and a parent `AGENTS.md` symlink targets a file outside `/work/app`
- **THEN** the symlink is ignored and `variant.root` is `/work/app`

#### Scenario: Not a git checkout
- **WHEN** `variants.yaml` is not in a git checkout and has no parent `AGENTS.md` symlink
- **THEN** `variant.main` and `variant.root` are the directory of `variants.yaml`
