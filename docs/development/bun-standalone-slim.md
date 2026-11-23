# Bun standalone slim

The `variant` executable is compiled with Bun, so it carries a Bun runtime.
The default runtime ships a bundler, a package manager, a test runner, `Bun.Image`, `bun:ffi` and more, none of which `variant` uses.
The release can instead embed a slim runtime: the upstream `bun-standalone` runtime, patched smaller by the build workflow.

## Space savings

Measured on macOS arm64 (Bun 1.4.4 for the default runtime), 1 KB = 1024 bytes.
Savings are against the default Bun runtime, taken on the compiled `variant`, because the default runtime is not a file the build produces.

| Build | `bun-standalone` runtime | Saved vs. standalone | compiled `variant` | Saved vs. default Bun |
|---|---:|---:|---:|---:|
| Original Bun (default runtime) | – | – | 64,364 KB | – |
| [Bun standalone](https://github.com/oven-sh/bun/pull/32262), as the pull request builds it | 46,187 KB | – | 49,783 KB | 22.7% |
| Standalone, `MinSizeRel`, C++ `-Os`, Rust `opt-level=z` | 40,022 KB | 13.3% | 43,634 KB | 32.2% |
| Same with C++ `-Oz` | 37,965 KB¹ | 17.8% | 41,577 KB | 35.4% |
| **Bun standalone slim** (also `Bun.Image` and `bun:ffi` stubbed) | **37,185 KB** | **19.5%** | **40,797 KB** | **36.6%** |

¹ Derived: the runtime file was not kept for this step. It is the `variant` size minus the 3,698,674 bytes that `variant` adds on top of the final runtime.
The final runtime is measured: 38,077,344 bytes.

The same comparison on the release executables, from the [release v0.0.12](https://github.com/jubr/variant-worktrees/releases/tag/v0.0.12) (default runtime) and the CI run [45059324331](https://github.com/jubr/variant-worktrees/actions/runs/45059324331) (slim runtime):

| Platform | Default Bun | Bun standalone slim | Saved |
|---|---:|---:|---:|
| darwin-arm64 | 63,784 KB | 40,797 KB | 36.0% |
| darwin-x64 | 70,700 KB | 44,392 KB | 37.2% |
| linux-arm64 | 82,354 KB | 54,635 KB | 33.7% |
| linux-x64 | 82,405 KB | 55,278 KB | 32.9% |

The darwin-arm64 row differs from the first table because the release executable (v0.0.12) and the local default build are different builds of `variant`.

Windows executables keep the default runtime.

## Which runtime is inside

`variant --version` names the runtime in its last line, between the platform and the repository URL:

```text
macos-arm64, bun-standalone-slim, https://github.com/jubr/variant-worktrees
macos-arm64, bun-standalone, https://github.com/jubr/variant-worktrees
macos-arm64, bun, https://github.com/jubr/variant-worktrees
```

- `bun-standalone-slim`: the patched runtime from this page.
- `bun-standalone`: the upstream standalone runtime, without the patches.
- `bun`: the default Bun runtime. A Linux or macOS release shows this when the slim runtime was not in the cache, and Windows always does.

Run from source under Node, the same line says `node`.
The token comes from the runtime itself, so it shows what the executable embeds, not what the build asked for.
[`runtimeToken`](https://github.com/jubr/variant-worktrees/blob/main/packages/variant-api/src/version-line.ts) reads `Bun.version` (the standalone runtime ends it in `-standalone`) and `Bun.Image` (only the slim runtime lacks it).

## The process

```text
upstream PR head ──► bun-standalone.yaml ──► cached runtime per platform ──► ci-release.yaml ──► variant executable
 (pull/32262)         patch, build, smoke       (key: head + workflow hash)     embeds it           VARIANT_BUN_RUNTIME
```

### 1. Upstream: `bun-standalone`

Bun [pull request 32262](https://github.com/oven-sh/bun/pull/32262) adds a `--standalone=on` build.
It gates the bundler, package manager, test runner and other tooling behind `cfg(bun_standalone)` and leaves a runtime that only runs a compiled program.
JavaScriptCore is a prebuilt 23 MB library and sets the size floor.

### 2. Build it in CI: `bun-standalone.yaml`

[`bun-standalone.yaml`](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml) builds the pull request head for darwin-arm64, darwin-x64, linux-x64 and linux-arm64.
There is no Bun fork.

- **When it runs:** a [six-hour schedule on the default branch, a manual dispatch, an edit to the workflow, and a call from the CI workflow](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L5-L13).
- **What it builds:** the [head commit of the upstream pull request](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L37-L63), not this repository.
- **When it compiles:** the [binary cache key](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L87-L92) holds the upstream head and the [hash of the workflow file](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L50-L52).
  A moved head or an edit to the workflow (including the patches) compiles; anything else restores the cached binary.
- **Toolchain:** [macOS](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L108-L113) installs `gnu-sed` next to LLVM 21; [Linux](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L115-L123) uses apt; both use the [pinned Rust nightly](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L124-L131).
- **Compile:** [`bun scripts/build.ts --profile=release --standalone=on --build-type=MinSizeRel`](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L282-L286). `MinSizeRel` is Bun's `smol` mode.
- **Smoke test:** [runs for a restored binary too](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L288-L301), so a bad cache entry cannot ship. It checks that `bun build` is gone, `Bun.Image` is undefined and `bun:ffi` throws "not available".

### 3. Patches: the [patch step](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/bun-standalone.yaml#L149-L281)

Bun has no Cargo feature left to switch off; the only gate is `cfg(bun_standalone)`.
The step edits the upstream checkout with GNU `sed`, prints a `diff -u` for every file, and fails when a patch changes nothing.
An upstream rewrite of those lines therefore shows up as a red run, not as a silently larger binary.
The macOS jobs install `gnu-sed` for this reason, and a spec runs the step on fixtures of the upstream lines.

| Patch | Upstream file (at the pull request head) | Effect |
|---|---|---|
| C++ `-Os` to `-Oz` | [`scripts/build/flags.ts`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/scripts/build/flags.ts#L262) | Smaller C++ code in `smol` mode. Only the first `-Os`; the LTO entry stays. |
| Rust `opt-level=z` | [`scripts/build/rust.ts`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/scripts/build/rust.ts#L729) | Sets `CARGO_PROFILE_RELEASE_OPT_LEVEL=z` when `smol` is on. |
| `Bun.Image` stub | [`src/runtime/lib.rs`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/src/runtime/lib.rs#L63), [`api/BunObject.rs`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/src/runtime/api/BunObject.rs#L1906), [`webcore/Body.rs`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/src/runtime/webcore/Body.rs#L993), [`image/Image.classes.ts`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/src/runtime/image/Image.classes.ts#L5), new `image_standalone_stub.rs` | libjpeg-turbo, libspng and libwebp drop out of the link. |
| `bun:ffi` stub | [`src/runtime/ffi/mod.rs`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/src/runtime/ffi/mod.rs#L22), [`ffi/ffi.classes.ts`](https://github.com/oven-sh/bun/blob/f1a99252afa733e83fdb20335d58b69991daa2da/src/runtime/ffi/ffi.classes.ts#L5), new `ffi_standalone_stub.rs` | TinyCC drops out of the link. `--tinycc=off` alone does not link, because the Rust `ffi` code still references TinyCC. |

The two stubs use the codegen `standaloneStub` flag, which emits zero-sized types and throwing thunks, so the C++ `extern` symbols still link.

### 4. Embed it: `ci-release.yaml`

[`ci-release.yaml`](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/ci-release.yaml) builds one executable per target.
For Linux and macOS it [restores the cached runtime](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/ci-release.yaml#L99-L107) and [sets `VARIANT_BUN_RUNTIME`](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/ci-release.yaml#L108-L110) before `task package:cli`.
A cache miss is not an error: the executable then embeds the default runtime.
Windows never restores or sets it.
A Linux runner can embed a macOS runtime, because the runtime is only a file to append the program to.

A manual dispatch of the release workflow takes a [`bun-standalone` input](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/.github/workflows/ci-release.yaml#L17) (`yes` or `no`) to try the slim runtime without merging.

[`scripts/package-cli.ts`](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/scripts/package-cli.ts#L52-L58) reads the variable and passes it to `Bun.build` as [`compile.executablePath`](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/scripts/package-cli.ts#L80-L94).
It fails before compiling when the path is not an executable file, and `task package:cli:all` refuses the variable because one runtime fits one platform.

## Use it locally

Build the runtime from a Bun checkout at the pull request head with the patches applied, then:

```bash
VARIANT_BUN_RUNTIME=/path/to/bun-standalone mise x -- task bleed:cli
```

This publishes the slim `variant` into `../vw-bleeds/variant-cli/bin`.
The compiled `variant` keeps the same commands, flags, output and exit codes whichever runtime it embeds.

## Not done

- The HTTP/2 and HTTP/3 fetch client (lshpack, lsquic, lsqpack) is about 1.3 MB with roughly 70 call sites in `bun_http`.
- Shell, `Bun.sql`, Redis, `HTMLRewriter`, markdown and archive are about 0.1 to 0.2 MB each.
- Turning off crash-report upload did not change the size.

The design notes and measurements are in [`openspec/changes/bun-optimized-bundle/design.md`](https://github.com/jubr/variant-worktrees/blob/79da4c8db1ffe7ded7227055e380be96bd098ad4/openspec/changes/bun-optimized-bundle/design.md#smaller-runtime-through-sed-patches).
