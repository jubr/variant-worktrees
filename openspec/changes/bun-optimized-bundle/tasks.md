## 1. Build the Bun pull request for arm64

- [ ] 1.1 Confirm the clone `_ref/oven-sh-bun` is at the PR head and note its commit; verify with `git log -1` there and record the commit in design.md
- [ ] 1.2 Install the build prerequisites named in the clone's CONTRIBUTING (rustup with the pinned nightly, CMake, Ninja, ccache); verify `rustup show` in the clone prints the pinned toolchain
- [ ] 1.3 Run `bun run build:standalone` in the clone on this arm64 host (long, run in the background, log to a file); verify `build/release-standalone/bun-standalone` exists and `file` reports `arm64`
- [ ] 1.4 Smoke the runtime alone: `bun-standalone -e 'console.log(Bun.version)'` prints a version, and `bun-standalone build x.ts` exits non-zero with its error; record both in design.md

## 2. Runtime hook in the compile script

- [ ] 2.1 Red: add `scripts/package-cli.spec.ts` tests for `VARIANT_BUN_RUNTIME`: unset/empty compiles as before, set passes the path to the compile call, missing or non-executable path throws naming the path, and `package:cli:all` refuses it; verify they fail
- [ ] 2.2 Green: implement the option in `compileCli` and the `all` path of `scripts/package-cli.ts`; verify the new tests pass
- [ ] 2.3 Add a `scripts/bleed.spec.ts` case showing a missing runtime leaves `vw-bleeds/variant-cli/bin` unchanged; verify it passes
- [ ] 2.4 Update the `bleed:cli` and `package:cli` descriptions in `Taskfile.yaml`, the bleed note in `CONTRIBUTING.md`, and `CHANGELOG.md` under Unreleased; verify `scripts/docs-coverage.spec.ts` and `scripts/bleed-tasks.spec.ts` pass
- [ ] 2.5 Commit the task group (code, tests, docs) as one Conventional Commit

## 3. Try it on the CLI

- [ ] 3.1 Run `VARIANT_BUN_RUNTIME=<path to bun-standalone> task bleed:cli`; verify the bled `variant` exists and record its size against the current 65.3 MB host binary
- [ ] 3.2 With the bled binary run `variant --version`, `variant list`, `variant ui --detach` (fetch the page at the printed URL), and `variant mcp` (initialize handshake); verify each matches the default-runtime binary and record any difference as a finding
- [ ] 3.3 Write the result (commit built, sizes, smoke outcome, verdict on pursuing release use) into design.md and verify no machine paths are committed
- [ ] 3.4 Run `task check:full` and `openspec validate --all --strict --no-interactive`; verify both pass
- [ ] 3.5 Show the final `task bleed:cli` command and its output, plus `variant --version` from the bled binary, in chat
