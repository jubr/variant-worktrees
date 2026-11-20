## ADDED Requirements

### Requirement: A test run leaves no process behind

A package test that starts a process SHALL stop it, and every process that process started, when the test ends, whether the test passed, failed or timed out. After `task test`, no process whose working directory is a temporary directory of a test SHALL remain. A test that waits for a condition SHALL give up before the test timeout, so that one slow condition fails that test and does not time out the tests after it.

#### Scenario: Passing test that leaves a watch running on purpose

- **WHEN** a test starts a detached watch with two processes and ends
- **THEN** both processes and their process groups are gone when the test ends

#### Scenario: Timed-out test

- **WHEN** a test times out while its watch processes run
- **THEN** those processes are stopped before the next test starts

#### Scenario: Slow wait

- **WHEN** a test waits for a condition that does not hold in time
- **THEN** it fails naming that condition before its test timeout

### Requirement: Slow package tests run as their own step

A package MAY split its slowest test files into a second `hk` step, `packages/<name>:test-slow`, so that the two steps of the package run concurrently and the `ci` profile finishes sooner. The `test` step SHALL run every test file that is not listed as slow, the `test-slow` step SHALL run exactly the listed files, and the `test:slow` script of the package SHALL be the list. Every listed file SHALL exist, and no test file SHALL run in both steps or in neither. The `ci` plan SHALL include a `test-slow` step for exactly the packages that have a `test:slow` script, and the default plan none. The steps that wait for the package tests (`test:scripts`, `docs:build`) SHALL wait for the `test-slow` steps too. `task test` SHALL run both.

#### Scenario: Plan lists both steps

- **WHEN** the `ci` plan is inspected and `variant-api` and `variant-cli` have a `test:slow` script
- **THEN** it lists `packages/variant-api:test`, `packages/variant-api:test-slow`, `packages/variant-cli:test` and `packages/variant-cli:test-slow`
- **AND** no other package has a `test-slow` step

#### Scenario: Every file runs once

- **WHEN** the `test` script ignores the files that `test:slow` runs
- **THEN** each test file of the package matches exactly one of the two scripts

#### Scenario: Stale list

- **WHEN** a file named by `test:slow` does not exist
- **THEN** the script tests fail naming that file
