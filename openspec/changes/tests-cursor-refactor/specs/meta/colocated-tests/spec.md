## Purpose

Keep each package test next to the module it covers. Fail the workspace test run when `packages/*/test` exists, and when a test file sits under `src/test`. Allow setup and similar helpers in `src/test`.

## ADDED Requirements

### Requirement: Package test directories are absent

The directory `packages/<package>/test` SHALL NOT exist. The workspace test run SHALL fail when that directory exists, and the failure SHALL name `packages/<package>/test` relative to the workspace root. A file inside that directory SHALL fail this check whether or not it is a test file. This requirement SHALL NOT apply to `packages/<package>/src/test`. The check SHALL NOT fail because of a test file outside `packages/`.

#### Scenario: Test file in the package test directory

- **WHEN** `packages/variant-config/test` exists and contains `schema.test.ts`
- **THEN** the workspace test run fails
- **AND** the failure names `packages/variant-config/test`

#### Scenario: Helper in the package test directory

- **WHEN** `packages/variant-vscode/test` exists and contains `setup.ts`
- **THEN** the workspace test run fails
- **AND** the failure names `packages/variant-vscode/test`

#### Scenario: Package test directories gone

- **WHEN** no package has a direct child directory named `test`
- **THEN** the workspace test run does not fail for a package test directory

#### Scenario: Repository scripts

- **WHEN** `scripts/docs-coverage.spec.ts` exists
- **THEN** the workspace test run does not fail for that file's location

### Requirement: Source test directories hold helpers only

A file under `packages/<package>/src` whose name ends in `.spec.ts`, `.spec.tsx`, `.test.ts`, or `.test.tsx` SHALL NOT have a path segment named `test`. The workspace test run SHALL fail when such a file exists, and the failure SHALL name that file relative to the workspace root. A file under `packages/<package>/src` that has a path segment named `test` and does not use one of those four suffixes SHALL NOT fail this check. That includes `setup.ts` and similar helpers.

#### Scenario: Spec inside src/test

- **WHEN** `packages/variant-api/src/test/slug.spec.ts` exists
- **THEN** the workspace test run fails
- **AND** the failure names `packages/variant-api/src/test/slug.spec.ts`

#### Scenario: Nested spec inside a test directory

- **WHEN** `packages/variant-api/src/operations/test/implode.spec.ts` exists
- **THEN** the workspace test run fails
- **AND** the failure names `packages/variant-api/src/operations/test/implode.spec.ts`

#### Scenario: setup.ts inside src/test

- **WHEN** `packages/variant-api/src/test/setup.ts` exists
- **THEN** the workspace test run does not fail for that file

#### Scenario: Similar helper inside src/test

- **WHEN** `packages/variant-api/src/test/mise-mock.ts` exists
- **THEN** the workspace test run does not fail for that file

### Requirement: Package tests use the spec suffix

A file under `packages/` whose name ends in `.test.ts` or `.test.tsx` SHALL NOT exist. The workspace test run SHALL fail when such a file exists, and the failure SHALL name that file relative to the workspace root. A package test file SHALL use `.spec.ts` or `.spec.tsx`.

#### Scenario: Leftover test suffix

- **WHEN** `packages/variant-vscode/src/extension.test.ts` exists
- **THEN** the workspace test run fails
- **AND** the failure names `packages/variant-vscode/src/extension.test.ts`

#### Scenario: Spec suffix

- **WHEN** the only test file for that module is `packages/variant-vscode/src/extension.spec.ts`
- **THEN** the workspace test run does not fail for a `.test.ts` suffix on that module

### Requirement: A unique source stem keeps its test beside it

When a package contains exactly one source file whose basename, without its extension, equals a test file's basename without `.spec.ts` or `.spec.tsx`, that test file SHALL be in the same directory as that source file. Source files are `.ts`, `.tsx`, and `.d.ts` files under that package's `src/` that are not themselves test files. The workspace test run SHALL fail when the test file is in a different directory, and the failure SHALL name the test file and the source file relative to the workspace root. A test file with no matching source stem, or with more than one, SHALL NOT fail this check.

#### Scenario: Matching module

- **WHEN** `packages/variant-api/src/slug.ts` is the only source file in that package with basename `slug` and the package has a test for that stem
- **THEN** the test file is `packages/variant-api/src/slug.spec.ts`

#### Scenario: Test left in another directory

- **WHEN** `packages/variant-api/src/slug.ts` is the only `slug` source file and `packages/variant-api/src/slug.spec.ts` is absent and `packages/variant-api/src/other/slug.spec.ts` exists
- **THEN** the workspace test run fails
- **AND** the failure names both paths

#### Scenario: No matching module

- **WHEN** a package has `src/product-icon.spec.ts` and no source file with basename `product-icon`
- **THEN** the workspace test run does not fail for a missing sibling

#### Scenario: Two source files share a stem

- **WHEN** a package has both `src/index.ts` and `src/db/index.ts`
- **THEN** the workspace test run does not fail a test file named `index.spec.ts` for stem placement
