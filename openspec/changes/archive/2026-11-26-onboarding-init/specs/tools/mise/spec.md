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

### Requirement: Bun on PATH matches the Bun Mise pins

Before provision, watch and up run the first host command of a variant, the system SHALL check the Bun that those commands find against the Bun version that Mise resolves for the project directory. The expected version SHALL come from Mise (`mise -C <projectDir> ls --current --json bun`), never from reading Mise configuration files. The actual Bun SHALL be the first executable named `bun` in the `PATH` of the command environment, and its version the output of `<that executable> --version`. When the expected version exists and differs from the actual version, the system SHALL log one warning per operation that names the expected version and its path (`mise which bun`), the actual version and its path, the `PATH` directory that comes first, and a hint on how to solve it. The hint SHALL (a) say how that Bun was probably installed and how to remove it, when its path shows it: under `~/.bun` the official installer (`rm -rf ~/.bun`), under a Homebrew prefix `brew uninstall bun`, under a `node_modules` directory `npm uninstall -g bun`, under a Mise `installs` directory (a path with the segments `mise/installs`, or under the `installs` directory of `MISE_DATA_DIR` when that is set) that it is another version installed by Mise, which SHALL NOT be deleted, and that `PATH` was probably inherited from a process that had Mise active for another project, so the editor or terminal is to be started again from a shell without that activation, and otherwise to delete that executable or uninstall the package that put it there; (b) name every line of the shell startup files `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` and `~/.config/fish/config.fish` that is not a comment and mentions the directory (as an absolute path, `~`, `$HOME` or `${HOME}`), as `<file>:<line>: <text>`, or say that none was found and name the files searched (for a Mise install, saying instead that no startup file adds it and that it came with the environment of the parent process); (c) say to open a new terminal and run `which -a bun`. Reading the startup files SHALL be the only file access of the hint, and it SHALL NOT change them. The check SHALL NOT change `PATH`, SHALL NOT fail or delay the command beyond running the two version probes, and SHALL be skipped silently when no Mise executable is found, when Mise reports no Bun for the project, when no `bun` is on `PATH`, or when a probe fails. It SHALL run at most once per operation, and not at all when the operation was given `miseInstall` `no`, which means that no Mise process runs.

#### Scenario: Another Bun first on PATH

- **WHEN** `mise.toml` pins `bun = "1.4.2"` and the command `PATH` holds a directory with Bun `1.3.0` before the Mise Bun directory
- **THEN** one warning names `1.4.2` with the Mise path, `1.3.0` with the other path and the directory that comes first, and the command still runs

#### Scenario: Hint names the shell startup line

- **WHEN** the foreign Bun is in `~/.bun/bin` and `~/.zshrc` holds `export PATH="$HOME/.bun/bin:$PATH"` on line 12
- **THEN** the warning names `rm -rf ~/.bun` and `~/.zshrc:12: export PATH="$HOME/.bun/bin:$PATH"`

#### Scenario: Hint when no startup file mentions the directory

- **WHEN** no searched startup file mentions the directory of the foreign Bun
- **THEN** the warning says that none was found and names the files it searched

#### Scenario: Another Mise version first on PATH

- **WHEN** `mise.toml` pins `bun = "1.3.9"` and the first `bun` on the command `PATH` is `/opt/mise/installs/bun/1.4.4/bin/bun`, and no startup file mentions `/opt/mise/installs/bun/1.4.4/bin`
- **THEN** the warning says that it is another version installed by Mise and that it is not to be deleted
- **AND** it says that `PATH` was probably inherited from a process with another Mise environment and that the editor or terminal is to be started again from a shell without it
- **AND** it does not say to delete the executable or to uninstall a package
- **AND** it does not say that "a tool or another file your shell reads" adds it

#### Scenario: Commented line

- **WHEN** a startup file mentions the directory only in a line that starts with `#`
- **THEN** that line is not named

#### Scenario: Same version through a different path

- **WHEN** the Bun on `PATH` is a symlink to the Mise Bun, or another install of the same version
- **THEN** no warning is logged

#### Scenario: Matching Bun

- **WHEN** the Bun on `PATH` is the pinned version
- **THEN** no warning is logged

#### Scenario: Bun not pinned

- **WHEN** Mise reports no Bun for the project directory
- **THEN** no warning is logged and no Bun is run

#### Scenario: Mise missing

- **WHEN** no Mise executable is found
- **THEN** no warning is logged and the operation continues

#### Scenario: Mise install no

- **WHEN** an operation runs with `miseInstall` `no` and the versions would differ
- **THEN** no Mise process runs and no warning is logged

#### Scenario: One warning per operation

- **WHEN** a watch operation starts two watches and the versions differ
- **THEN** exactly one warning is logged
