## MODIFIED Requirements

### Requirement: Changelog release notes

For the new version, release preparation SHALL add to every `CHANGELOG*.md` of the repository root and of each package a section headed `## [<version>] - <YYYY-MM-DD>`. That section SHALL hold the former contents of the `Unreleased` section, if the changelog has one, followed by a `### Release notes` subsection with the notes GitHub generates for the pull requests merged since the previous release tag. The `Unreleased` section SHALL be removed: a changelog SHALL NOT contain an `Unreleased` heading after release preparation, bracketed or not. The new section SHALL take the place of the `Unreleased` section, or directly precede the newest version section when there was none. A changelog without an `Unreleased` section SHALL NOT fail release preparation. Text outside the `Unreleased` section SHALL NOT change. A contributor who records the next change SHALL add a `## Unreleased` heading again when none exists.

#### Scenario: Unreleased is promoted

- **WHEN** `CHANGELOG.md` has bullets under `## Unreleased` and the release version is `1.2.4`
- **THEN** those bullets appear under `## [1.2.4] - <date>`, followed by `### Release notes`
- **AND** the changelog has no `Unreleased` heading

#### Scenario: Bracketed heading removed

- **WHEN** a package changelog has `## [Unreleased]` above its version sections
- **THEN** the released changelog has no `Unreleased` heading, bracketed or not

#### Scenario: Nothing under Unreleased

- **WHEN** a changelog has an empty `Unreleased` section
- **THEN** its new version section holds only the `### Release notes` subsection
- **AND** the changelog has no `Unreleased` heading

#### Scenario: No Unreleased section

- **WHEN** a changelog has no `Unreleased` section, because the previous release removed it and nothing was recorded since
- **THEN** release preparation succeeds
- **AND** the new version section holds only the `### Release notes` subsection and sits directly above the previous version section

#### Scenario: Notes come from GitHub

- **WHEN** GitHub generates notes between the previous release tag and the new version
- **THEN** each pull request line of those notes appears under `### Release notes` in every changelog

#### Scenario: Version section already present

- **WHEN** a changelog already has a section for the new version
- **THEN** the task fails and writes nothing

## ADDED Requirements

### Requirement: Unpacked extension for local loading

`task package:vsix:unpacked` SHALL build and package the variant-worktrees extension and unpack it into `out/variant-worktrees-main` of the main checkout, with `package.json` at that folder's root so Cursor or VS Code can load it. It SHALL run in the main checkout and in a variant worktree: from a variant worktree it SHALL publish into the main checkout, from the main checkout into its own `out` directory.

#### Scenario: Run in a variant worktree

- **WHEN** the task runs in a linked variant worktree
- **THEN** the unpacked extension is written to `out/variant-worktrees-main` of the main checkout, and the worktree's own `out` gets no such folder

#### Scenario: Run in the main checkout

- **WHEN** the task runs in the main checkout
- **THEN** the unpacked extension is written to `out/variant-worktrees-main` of that checkout and the task succeeds

#### Scenario: Stale files replaced

- **WHEN** the destination already holds files that the new package does not contain
- **THEN** the destination holds exactly the new package
