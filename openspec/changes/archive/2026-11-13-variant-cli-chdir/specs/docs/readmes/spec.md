## MODIFIED Requirements

### Requirement: Repository README content

The repository README SHALL show the product, say how to install the CLI with `mise use github:jubr/variant-worktrees`, describe the human and agent workflow, and keep its `variants.yaml` configuration, CLI, MCP, and chat renamer sections. Its CLI section SHALL show every `variant` command and SHALL list the global flags (`-C`, `--json`, `--yaml`) in a "Global flags" subsection apart from the per-command flags. That subsection SHALL describe `-C <path>` as changing the directory before configuration is read, and SHALL NOT list `--chdir`. Contributor workflow SHALL be limited to a pointer to `CONTRIBUTING.md`.

#### Scenario: Install and contributor pointer

- **WHEN** the repository README is read
- **THEN** it contains `mise use github:jubr/variant-worktrees`
- **AND** it links to `CONTRIBUTING.md`
- **AND** it contains no `task lint` command

#### Scenario: Every command shown

- **WHEN** the CLI section of the repository README is read
- **THEN** it shows `variant status` and every other command the CLI lists

#### Scenario: Global flags apart

- **WHEN** the CLI section of the repository README is read
- **THEN** a "Global flags" subsection lists `-C`, `--json`, and `--yaml`
- **AND** that subsection does not list `--chdir`
- **AND** the per-command flags are not listed in that subsection
