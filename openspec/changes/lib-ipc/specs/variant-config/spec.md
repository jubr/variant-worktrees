## ADDED Requirements

### Requirement: Main .vscode directory

`resolveMainVscodeDir` SHALL return the absolute path of the main checkout `.vscode` directory for a start directory. It SHALL NOT create that directory and SHALL NOT append a socket file name. A `.vscode` directory inside a `_v-*` worktree SHALL NOT be the result. A nested package `.vscode` that has no `settings.json` SHALL NOT be the result when the main checkout `.vscode` contains `settings.json`.

#### Scenario: Path for the main checkout

- **WHEN** resolution starts at `/work/vw/variant-worktrees`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Package .vscode is skipped

- **WHEN** `/work/vw/variant-worktrees/packages/variant-vscode/.vscode/launch.json` exists and that `.vscode` directory has no `settings.json`
- **AND** `/work/vw/variant-worktrees/.vscode/settings.json` exists
- **AND** resolution starts at `/work/vw/variant-worktrees/packages/variant-vscode`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

### Requirement: Linked checkout container

When a start directory sits under a container whose `AGENTS.md` is a symlink to the main checkout, resolution SHALL use that symlink target's `.vscode` directory. A `.vscode` directory on the container that symlinks at the main checkout's `.vscode` SHALL be the same directory. A `.vscode` directory inside a `_v-*` worktree SHALL NOT be the result, including when that worktree directory contains `settings.json`.

#### Scenario: Worktree under a symlink container

- **WHEN** `/work/vw/.vscode` symlinks to `/work/vw/variant-worktrees/.vscode`
- **AND** `/work/vw/AGENTS.md` symlinks to `/work/vw/variant-worktrees/AGENTS.md`
- **AND** `/work/vw/_v-lib-ipc` contains `variants.yaml` and its own `.vscode/settings.json`
- **AND** resolution starts at `/work/vw/_v-lib-ipc`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Nested directory in the worktree

- **WHEN** the layout is the symlink container above and resolution starts at `/work/vw/_v-lib-ipc/packages/variant-api`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Start at the container

- **WHEN** the layout is the symlink container above and resolution starts at `/work/vw`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

#### Scenario: Start inside the main checkout

- **WHEN** the layout is the symlink container above and resolution starts at `/work/vw/variant-worktrees`
- **THEN** the result is `/work/vw/variant-worktrees/.vscode`

### Requirement: Single repo holding worktrees

When the directory that contains the `_v-*` worktrees also contains the real `AGENTS.md`, resolution SHALL return that directory's `.vscode`. A `.vscode` directory inside a worktree SHALL NOT be the result, including when it contains `settings.json`.

#### Scenario: Worktree under a single repo

- **WHEN** `/work/AGENTS.md` is a regular file
- **AND** `/work/_v-lib-ipc` contains `variants.yaml` and its own `.vscode/settings.json`
- **AND** resolution starts at `/work/_v-lib-ipc`
- **THEN** the result is `/work/.vscode`

#### Scenario: Nested directory in a single-repo worktree

- **WHEN** the layout is the single repo above and resolution starts at `/work/_v-lib-ipc/packages/variant-api`
- **THEN** the result is `/work/.vscode`

#### Scenario: Start at the single repo root

- **WHEN** the layout is the single repo above and resolution starts at `/work`
- **THEN** the result is `/work/.vscode`
