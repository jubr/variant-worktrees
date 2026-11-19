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
