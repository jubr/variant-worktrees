## MODIFIED Requirements

### Requirement: Implode cleanup patterns on both runtimes

The patterns of `variant.implode.preRm` SHALL match the same paths under Node and Bun: `*`, `**`, `?`, character classes and `{a,b}` alternatives, dotfiles included, files and directories alike, relative to the project directory and to each instance directory. A match outside the worktree SHALL be ignored, symbolic links SHALL NOT be followed, and a match that is or contains a tracked file SHALL never be deleted.

#### Scenario: Wildcard match

- **WHEN** `preRm` is `["openspec/changes/{{slug}}/pr*-demo.webm"]`, an untracked `openspec/changes/demo/pr7-demo.webm` exists and `implode` runs for `demo` under Node
- **THEN** that file is removed

#### Scenario: Alternatives and dotfiles

- **WHEN** `preRm` is `["{out,dist}/**", ".cache/*"]` and untracked files exist in `out/a/b.js`, `dist/c.js` and `.cache/d`
- **THEN** all three are removed under either runtime

#### Scenario: Directory name

- **WHEN** `preRm` is `[node_modules]` and an untracked `fe/node_modules` exists next to an instance `fe`
- **THEN** the directory is removed under either runtime

#### Scenario: Tracked file kept

- **WHEN** a tracked file matches a pattern
- **THEN** it stays
