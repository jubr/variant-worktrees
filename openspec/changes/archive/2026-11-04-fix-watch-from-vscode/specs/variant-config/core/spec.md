## ADDED Requirements

### Requirement: The variant root is a workspace

When the starting directory is not a git checkout and it holds an `AGENTS.md` symlink whose target is a real file inside a git checkout that contains `variants.yaml`, that directory SHALL be the variant root and that checkout SHALL be `variant.main`. The loaded configuration SHALL be the real `variants.yaml` in that checkout. The start SHALL NOT need a `variants.yaml` in the variant root. `variant.root` SHALL be that directory when it is not set in the file.

#### Scenario: Root with no variants.yaml

- **WHEN** `/work` is not a git checkout, `/work` has no `variants.yaml`, `/work/AGENTS.md` is a symlink to `/work/app/AGENTS.md`, and `/work/app/variants.yaml` is a real file that does not set `variant.main` or `variant.root`
- **THEN** the configuration loaded from `/work` is `/work/app/variants.yaml`
- **AND** `variant.main` is `/work/app` and `variant.root` is `/work`

#### Scenario: Main checkout is unchanged

- **WHEN** configuration is loaded from `/work/app` in that layout
- **THEN** the loaded file is `/work/app/variants.yaml` and `variant.main` is `/work/app`

### Requirement: A variants.yaml symlink in the variant root is an anti-pattern

A `variants.yaml` or `variants.yml` that is a symbolic link in the variant root SHALL NOT be the loaded configuration. The loaded file SHALL be the real `variants.yaml` in the main checkout, as in the requirement above. The resolved configuration SHALL carry a warning that names the symlink's path and says that a `variants.yaml` symlink in the variant root is an anti-pattern. A real `variants.yaml` file in the variant root SHALL still be the configuration, with no such warning.

#### Scenario: Symlink is skipped and warned

- **WHEN** `/work/variants.yaml` is a symlink to `/work/app/variants.yaml` and `/work/AGENTS.md` is a symlink into `/work/app`
- **THEN** the loaded file is the real `/work/app/variants.yaml`
- **AND** the warnings name `/work/variants.yaml` and say it is an anti-pattern

#### Scenario: Real file is not a warning

- **WHEN** `/work/variants.yaml` is a real file and not a symlink
- **THEN** that file is the configuration and the warnings do not call it an anti-pattern
