# Mocking

Default to real code paths. Use a test double only when a dependency is outside the test's control or would make the test unsafe, slow, or nondeterministic.

Pass external dependencies in rather than constructing them internally, and prefer named operations over a generic fetcher with endpoint-dependent behavior.

## Decide in this order

1. Use the real dependency when it is cheap and deterministic.
2. Prefer a temporary directory, in-memory adapter, local service, or test database over mocking code you own.
3. Replace only an external boundary with a focused fake or stub.
4. Assert the observable outcome. Assert calls only when the interaction itself is the promised behavior.

Typical boundaries include third-party APIs, email or payment gateways, clocks, randomness, operating-system effects, and unavailable remote infrastructure. Do not mock internal collaborators merely for convenience; doing so freezes the current design into the test and creates false failures during refactoring.
