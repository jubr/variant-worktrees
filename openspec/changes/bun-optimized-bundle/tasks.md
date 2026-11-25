## 1. Build the Bun pull request for arm64

- [x] 1.1 Confirm the Bun clone is at the PR head and note its commit; verify with `git log -1` there and record the commit in design.md
- [x] 1.2 Install the build prerequisites named in the clone's CONTRIBUTING (rustup with the pinned nightly, CMake, Ninja, ccache); verify `rustup show` in the clone prints the pinned toolchain
- [x] 1.3 Run `bun run build:standalone` in the clone on this arm64 host (long, run in the background, log to a file); verify `build/release-standalone/bun-standalone` exists and `file` reports `arm64`
- [x] 1.4 Smoke the runtime alone: `bun-standalone -e 'console.log(Bun.version)'` prints a version, and `bun-standalone build x.ts` exits non-zero with its error; record both in design.md

## 2. Runtime hook in the compile script

- [x] 2.1 Red: add `scripts/package-cli.spec.ts` tests for `VARIANT_BUN_RUNTIME`: unset/empty compiles as before, set passes the path to the compile call, missing or non-executable path throws naming the path, and `package:cli:all` refuses it; verify they fail
- [x] 2.2 Green: implement the option in `compileCli` and the `all` path of `scripts/package-cli.ts`; verify the new tests pass
- [x] 2.3 Add a `scripts/bleed.spec.ts` case showing a missing runtime leaves `vw-bleeds/variant-cli/bin` unchanged; verify it passes
- [x] 2.4 Update the `bleed:cli` and `package:cli` descriptions in `Taskfile.yaml`, the bleed note in `CONTRIBUTING.md`, and `CHANGELOG.md` under Unreleased; verify `scripts/docs-coverage.spec.ts` and `scripts/bleed-tasks.spec.ts` pass
- [ ] 2.5 Commit the task group (code, tests, docs) as one Conventional Commit

## 3. Try it on the CLI

- [x] 3.1 Run `VARIANT_BUN_RUNTIME=<path to bun-standalone> task bleed:cli`; verify the bled `variant` exists and record its size against the current 65.3 MB host binary
- [x] 3.2 With the bled binary run `variant --version`, `variant list`, `variant ui --detach` (fetch the page at the printed URL), and `variant mcp` (initialize handshake); verify each matches the default-runtime binary and record any difference as a finding
- [x] 3.3 Write the result (commit built, sizes, smoke outcome, verdict on pursuing release use) into design.md and verify no machine paths are committed
- [x] 3.4 Run `task check:full` and `openspec validate --all --strict --no-interactive`; verify both pass
- [x] 3.5 Show the final `task bleed:cli` command and its output, plus `variant --version` from the bled binary, in chat

## 4. Build workflow for the pull request head

- [x] 4.1 Red: add `scripts/bun-standalone-workflow.spec.ts` asserting the triggers (schedule, dispatch, push limited to the workflow file, no `pull_request`, no `workflow_call`), `contents: read`, and that no other workflow uses it; verify it fails because the file is missing
- [x] 4.2 Green: add `.github/workflows/bun-standalone.yaml` with the triggers and a `resolve` job that outputs the pull request head sha; verify the spec passes and `task lint:workflows` is clean
- [x] 4.3 Red then green: the binary cache key holds the platform, the resolved sha and `hashFiles` of the workflow; the dependency cache restores by prefix; every toolchain and compile step runs only when the binary cache missed
- [x] 4.4 Red then green: matrix of darwin-arm64, linux-x64 and linux-arm64; smoke test of version, script and refused `build`; archives `bun-standalone-<os>-<arch>.zip` uploaded with `actions/upload-artifact` v7; summary names the sha
- [x] 4.5 Record the workflow in `CHANGELOG.md` and `CONTRIBUTING.md` (CI list); verify `task check:full` passes

## 5. Run the build in CI and use it in the release

- [x] 5.1 Red then green: `bun-standalone.yaml` builds darwin-arm64, darwin-x64, linux-x64 and linux-arm64, takes `workflow_call` with outputs `sha` and `workflow`, and its concurrency group includes the calling workflow; update `scripts/bun-standalone-workflow.spec.ts` first and verify it fails
- [x] 5.2 Red then green: `ci-branch.yaml` has the job `Bun standalone` calling it, conditioned on `main` or a `bun-standalone` input of `yes`, and returns `sha` and `workflow`; verify a spec over the workflow files passes and `task lint:workflows` is clean
- [x] 5.3 Red then green: `ci-release.yaml` takes the input `bun-standalone` (`no` default) and passes it to the CI call; `build` becomes one job per platform running `task package:cli TARGET=<target>`, a `.vsix` job, and a gather job that still uploads `release-assets` with `SHA256SUMS`; verify the specs over the release workflow pass
- [x] 5.4 Red then green: Linux and macOS jobs restore `bun-standalone-<platform>-<sha>-<workflow>` without failing on a miss and set `VARIANT_BUN_RUNTIME` on a hit; Windows jobs have neither step; replace the old guard in `scripts/package-cli.spec.ts` with these checks
- [x] 5.5 Update `CHANGELOG.md` and `CONTRIBUTING.md` for the job, the input and the matrix; verify `task check:full` passes and `openspec validate --all --strict --no-interactive` passes
- [x] 5.6 After the branch is pushed: dispatch `ci-release.yaml` from it with `bun-standalone` set to `yes` (a dry run), verify the compile runs once and a second dispatch compiles nothing, and verify the Linux and macOS jobs report the embedded runtime; record both runs in design.md

## 6. Smaller runtime through sed patches

- [x] 6.1 Red then green: `bun-standalone.yaml` has a `patch` step between the checkout and the compile that patches with sed, prints `diff -u` per file, fails on an unchanged file, and runs on fixtures of the upstream lines; the compile uses `--build-type=MinSizeRel`; the smoke test checks `Bun.Image` and `dlopen`; verify `scripts/bun-standalone-workflow.spec.ts` fails first
- [x] 6.2 Run the patch step on a clean checkout of the pull request head and compare the result with the local experiment; verify they match apart from comments
- [x] 6.3 Update `CHANGELOG.md`, `CONTRIBUTING.md` and `design.md` (patches, sizes); verify `task check:full` and `openspec validate --all --strict --no-interactive` pass
- [x] 6.4 After the push: the workflow compiles on its own push (the file changed); verify each patch diff is in the log, the smoke test passes on all four platforms, and record the sizes in design.md

## 7. Name the runtime in the version output

- [x] 7.1 Red then green: `variant --version` prints `platform, runtime, url` with `node`, `bun`, `bun-standalone` or `bun-standalone-slim`; verify the `version-line` and `runtimes` specs fail first, and check the three Bun names on compiled executables
- [x] 7.2 Add the docs page "Bun standalone slim" with the savings table, the process and the version output; verify `task docs:build` passes

## 8. Fetch the published slim runtime

- [ ] 8.1 Red then green: `scripts/bun-slim.ts` reads the exact Bun version from `mise.toml`, picks the highest build of it among the `bun-slim-vX.Y.Z-N` tags, downloads `bun-slim-<os>-<arch>-v*.zip`, checks `SHA256SUMS` and returns the `bun-slim` executable; `scripts/fetch-bun-slim.ts` warns and exits 0 on any failure; verify `scripts/bun-slim.spec.ts` fails first
- [ ] 8.2 Red then green: remove `bun-standalone.yaml` and the `Bun standalone` CI job and input; the release matrix fetches the slim runtime after mise and install and before the compile, for Linux and macOS only; verify `scripts/ci-release-workflow.spec.ts` and `task lint:workflows` pass
- [ ] 8.3 Red then green: `task chore:bun:bump` edits `mise.toml`, `@types/bun` and `bun.lock` to the latest bun-slim release (or `VERSION=`) and commits `chore(bun): bump to vX.Y.Z`; verify `scripts/bump-bun.spec.ts` fails first
- [ ] 8.4 Update the docs page, `CONTRIBUTING.md`, `CHANGELOG.md`, `proposal.md` and `design.md`; verify `task check:full` and `openspec validate --all --strict --no-interactive` pass

