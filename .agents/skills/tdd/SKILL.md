---
name: tdd
description: >
  Use test-driven development for testable behavior changes: implementation tasks, features, bug fixes, and behavior-changing refactors, even when tests are not requested. Also use when adding regression or integration tests, reproducing a bug, or the user mentions TDD, test-first, or red-green-refactor. Skip documentation, formatting, and configuration changes with no testable behavior.
---

# Test-driven development

## Tools

- If not in `mise hook-env`: Always `mise x -- …` for `openspec`, `task`, `bun`, and other project tools.
  This applies to all command invocations in this file. Also note `mise` manages env vars for child processes.

Tests define behavior; production code makes tests pass. Follow the repository's test conventions.

**Mandatory:** Complete RED → GREEN → REFACTOR for one behavior before writing the next failing test. Never batch RED tests.

Sequence increments from the simplest case that meaningfully constrains the behavior, then triangulate with an example that rules out a plausible shortcut and drives the general rule.

## Red-Green-Refactor

1. **RED:** Before changing production code, write or update one focused test for the next observable behavior. Use a stable interface and an expected result derived independently from the implementation. Run the narrowest relevant test. RED counts only when it fails for the intended behavioral reason, not because of syntax, compilation, imports, or setup. If it passes immediately, correct an ineffective test or make no production change.
2. **GREEN:** Write the minimum production code needed to pass. Do not anticipate later cases or add unrelated cleanup. Run the focused test until it passes. Never weaken, delete, or skip a valid test. If evidence shows an expectation is wrong, stop GREEN, justify and correct it from the source of truth, then return to RED; never change a correct expectation merely to fit the implementation.
3. **REFACTOR:** Only while GREEN, improve production and test code touched by the change without altering behavior. Re-run tests after each meaningful step.
4. **VERIFY:** Run the related suite and broader project checks when feasible. Report the commands and actual outcomes; never claim checks that did not run.

## Exceptions and references

- For a bug, first add a regression test that fails because of the bug, then keep it as protection against recurrence.
- For a behavior-preserving refactor, establish a GREEN baseline and keep it green; do not manufacture RED. Characterization tests may pass immediately.
- If tests cannot run, fix in-scope setup problems or report the exact blocker before making further behavior changes.
- Read [test-quality.md](references/test-quality.md) when the test seam, scope, or expected result is uncertain, or before testing in an unfamiliar codebase.
- Read [mocking.md](references/mocking.md) before adding any mock, stub, or fake.
