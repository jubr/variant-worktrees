## MODIFIED Requirements

### Requirement: Augmenting the Mise configuration

The system SHALL offer, in `variant-api` for every caller, a step that makes the Mise configuration of a directory list
the tool `packslip:jubr/variant-worktrees` with the version `latest`, the entry `mise use packslip:jubr/variant-worktrees`
would add, without installing anything. The tool `github:jubr/variant-worktrees` is the same program from the same repository, so a
configuration that lists either of the two tools SHALL count as listing the tool. The file SHALL be chosen by taking the entries of `mise -C <dir> config ls
--json`, keeping only those inside the git checkout of the directory (the directory itself when it is not in a
checkout), dropping those with `.local.` in the file name, and taking the first, the closest by directory. Any file
name and location that Mise supports qualifies (`mise.toml`, `.mise.toml`, `mise/config.toml`, `.mise/config.toml`,
`.config/mise.toml`, and the like). When none remains, `mise.toml` SHALL be created in the directory with a `[tools]`
table. In the chosen file the entry SHALL be added to its `[tools]` table without changing any other line, a `[tools]`
table SHALL be added when there is none, and nothing SHALL change when the tool is already listed. An existing
`github:jubr/variant-worktrees` entry SHALL NOT be rewritten or removed. A file that is not
valid, or that defines `tools` in a form that cannot be extended in place, SHALL be left unchanged and the result
SHALL say why. When no Mise executable is found the step SHALL change nothing and report that Mise was not found, the
places searched, and the editor setting and configuration key `variant.mise.binPath`.

#### Scenario: Created

- **WHEN** `mise config ls` lists no file inside the checkout
- **THEN** `mise.toml` is created with `[tools]` and `"packslip:jubr/variant-worktrees" = "latest"`

#### Scenario: Added to existing tools

- **WHEN** `mise.toml` has `[tools]` with `node = "22"` and an `[env]` table
- **THEN** the new entry is added to `[tools]` and every other line is unchanged

#### Scenario: Other official file

- **WHEN** the only configuration file is `.config/mise.toml` with a `[tools]` table
- **THEN** the entry is added there and no `mise.toml` is created

#### Scenario: Local files dropped

- **WHEN** `mise config ls` lists `mise.local.toml` first and `mise.toml` second, both in the checkout
- **THEN** only `mise.toml` changes

#### Scenario: Closest file

- **WHEN** `mise config ls` lists `app/mise.toml` first and `mise.toml` of the checkout root second, and the step runs in `app`
- **THEN** only `app/mise.toml` changes

#### Scenario: Ancestor in the checkout

- **WHEN** the step runs in `app`, which has no configuration, and the checkout root has `mise.toml`
- **THEN** the entry is added to the `mise.toml` of the checkout root

#### Scenario: Outside the checkout

- **WHEN** the only other listed files are the global configuration and a `.mise.toml` above the checkout
- **THEN** neither is changed and `mise.toml` is created in the directory

#### Scenario: No tools table

- **WHEN** `mise.toml` has only `[env]`
- **THEN** a `[tools]` table with the entry is appended

#### Scenario: Already listed

- **WHEN** the configuration already lists `packslip:jubr/variant-worktrees`
- **THEN** no file is changed and the result says so

#### Scenario: Listed through the github backend

- **WHEN** the configuration already lists `github:jubr/variant-worktrees`
- **THEN** no file is changed, no `packslip:` entry is added and the result says the tool is already listed

#### Scenario: Invalid file

- **WHEN** the chosen file is not valid TOML
- **THEN** it is unchanged and the result names the problem

#### Scenario: Mise missing

- **WHEN** no Mise executable is found
- **THEN** nothing changes and the result says that Mise was not found, names the places searched and `variant.mise.binPath`
