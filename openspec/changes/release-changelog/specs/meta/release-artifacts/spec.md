## ADDED Requirements

### Requirement: Release preparation task

`task release:prepare` SHALL prepare a patch release from `main` in one command: bump the lockstep version, write release notes into the changelogs, commit them on the branch `release/v<version>`, push that branch, and open a GitHub pull request into `main`. It SHALL NOT create a tag, merge the pull request, or publish anything. It SHALL refuse to start, before changing any file, unless the checkout is on `main`, has a clean working tree, is not behind `origin/main`, the release packages share one version, and `gh` is authenticated.

#### Scenario: Prepare a release

- **WHEN** a maintainer runs `task release:prepare` on a clean, current `main` whose release version is `1.2.3`
- **THEN** the branch `release/v1.2.4` exists on `origin` with one commit `chore(release): v1.2.4` that bumps every release package to `1.2.4` and updates the changelogs
- **AND** a pull request from that branch into `main` is open
- **AND** no tag `v1.2.4` exists

#### Scenario: Not on main

- **WHEN** the checkout is on a branch other than `main`
- **THEN** the task fails naming the branch and no file is changed

#### Scenario: Dirty working tree

- **WHEN** the working tree has uncommitted changes
- **THEN** the task fails and no file is changed

#### Scenario: Behind origin

- **WHEN** `main` is behind `origin/main`
- **THEN** the task fails and no file is changed

#### Scenario: Versions differ

- **WHEN** the release packages do not share one version
- **THEN** the task fails with the version disagreement and no file is changed

### Requirement: Changelog release notes

For the new version, release preparation SHALL add to every `CHANGELOG*.md` of the repository root and of each package a section headed `## [<version>] - <YYYY-MM-DD>` directly below the `Unreleased` section. That section SHALL hold the former contents of `Unreleased`, followed by a `### Release notes` subsection with the notes GitHub generates for the pull requests merged since the previous release tag. The `Unreleased` section SHALL stay in place and be empty afterwards. Text outside the `Unreleased` section SHALL NOT change.

#### Scenario: Unreleased is promoted

- **WHEN** `CHANGELOG.md` has bullets under `## Unreleased` and the release version is `1.2.4`
- **THEN** those bullets appear under `## [1.2.4] - <date>`, followed by `### Release notes`
- **AND** `## Unreleased` is directly above that section with no content

#### Scenario: Nothing under Unreleased

- **WHEN** a changelog has an empty `Unreleased` section
- **THEN** its new version section holds only the `### Release notes` subsection

#### Scenario: Notes come from GitHub

- **WHEN** GitHub generates notes between the previous release tag and the new version
- **THEN** each pull request line of those notes appears under `### Release notes` in every changelog

#### Scenario: Version section already present

- **WHEN** a changelog already has a section for the new version
- **THEN** the task fails and writes nothing

### Requirement: Release pull request

The release pull request SHALL be titled `chore(release): v<version>`, SHALL target `main`, and SHALL carry the generated release notes as its body. A failure after the files changed SHALL leave the working tree for the maintainer to inspect, and `task release:pr` SHALL be re-runnable to retry the commit, push, and pull request.

#### Scenario: Pull request content

- **WHEN** the pull request for `v1.2.4` is opened
- **THEN** its title is `chore(release): v1.2.4`, its base is `main`, and its body is the generated release notes

#### Scenario: Push fails

- **WHEN** pushing the release branch fails
- **THEN** the task exits non-zero and the version bump and changelog edits remain in the working tree
