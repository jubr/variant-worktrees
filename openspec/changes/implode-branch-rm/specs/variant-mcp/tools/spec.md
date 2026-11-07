## MODIFIED Requirements

### Requirement: variant_implode tool

The system SHALL expose a `variant_implode` MCP tool accepting an optional slug, an optional `force` flag, and an optional `branchRm` choice of `yes` or `no` that implodes the variant (see the implode capability) and returns the implode report, the removed worktree path, and whether the local branch was removed. Omitted `branchRm` SHALL remove the local branch. The tool SHALL reject a `branchRm` value other than `yes` or `no`. The tool `variant_destroy` SHALL NOT exist.

#### Scenario: Implode a merged variant

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature" })` for a merged variant on branch `feat/test-feature`
- **THEN** the variant is dropped, state is cleared, the worktree is removed, the local branch is removed, and the result names the worktree and the branch

#### Scenario: Branch kept

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature", branchRm: "no" })` for a merged variant on branch `feat/test-feature`
- **THEN** the worktree is removed and the local branch `feat/test-feature` still exists

#### Scenario: Unmerged refused

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature" })` for an unmerged variant without `force`
- **THEN** the tool returns an error that names `force`

#### Scenario: Boolean branchRm rejected

- **WHEN** an MCP client calls `variant_implode({ slug: "test-feature", branchRm: true })`
- **THEN** the tool returns an error and the variant is unchanged

#### Scenario: Destroy tool is gone

- **WHEN** an MCP client lists tools
- **THEN** the result has no `variant_destroy` tool
