## ADDED Requirements

### Requirement: Bun on PATH matches the Bun Mise pins

Before provision, watch and up run the first host command of a variant, the system SHALL check the Bun that those commands find against the Bun version that Mise resolves for the project directory. The expected version SHALL come from Mise (`mise -C <projectDir> ls --current --json bun`), never from reading Mise configuration files. The actual Bun SHALL be the first executable named `bun` in the `PATH` of the command environment, and its version the output of `<that executable> --version`. When the expected version exists and differs from the actual version, the system SHALL log one warning per operation that names the expected version and its path (`mise which bun`), the actual version and its path, the `PATH` directory that comes first, and a hint on how to solve it. The hint SHALL (a) say how that Bun was probably installed and how to remove it, when its path shows it: under `~/.bun` the official installer (`rm -rf ~/.bun`), under a Homebrew prefix `brew uninstall bun`, under a `node_modules` directory `npm uninstall -g bun`, and otherwise to delete that executable or uninstall the package that put it there; (b) name every line of the shell startup files `~/.zshrc`, `~/.zshenv`, `~/.zprofile`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` and `~/.config/fish/config.fish` that is not a comment and mentions the directory (as an absolute path, `~`, `$HOME` or `${HOME}`), as `<file>:<line>: <text>`, or say that none was found and name the files searched; (c) say to open a new terminal and run `which -a bun`. Reading the startup files SHALL be the only file access of the hint, and it SHALL NOT change them. The check SHALL NOT change `PATH`, SHALL NOT fail or delay the command beyond running the two version probes, and SHALL be skipped silently when no Mise executable is found, when Mise reports no Bun for the project, when no `bun` is on `PATH`, or when a probe fails. It SHALL run at most once per operation, and not at all when the operation was given `miseInstall` `no`, which means that no Mise process runs.

#### Scenario: Another Bun first on PATH

- **WHEN** `mise.toml` pins `bun = "1.4.2"` and the command `PATH` holds a directory with Bun `1.3.0` before the Mise Bun directory
- **THEN** one warning names `1.4.2` with the Mise path, `1.3.0` with the other path and the directory that comes first, and the command still runs

#### Scenario: Hint names the shell startup line

- **WHEN** the foreign Bun is in `~/.bun/bin` and `~/.zshrc` holds `export PATH="$HOME/.bun/bin:$PATH"` on line 12
- **THEN** the warning names `rm -rf ~/.bun` and `~/.zshrc:12: export PATH="$HOME/.bun/bin:$PATH"`

#### Scenario: Hint when no startup file mentions the directory

- **WHEN** no searched startup file mentions the directory of the foreign Bun
- **THEN** the warning says that none was found and names the files it searched

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
