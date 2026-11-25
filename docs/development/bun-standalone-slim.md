# Bun standalone slim

The `variant` executable is compiled with Bun, so it carries a Bun runtime.
The runtime that ships with Bun has a bundler, a package manager, a test runner, `Bun.Image`, `bun:ffi` and more, and `variant` uses none of them.
The release can embed a slimmer runtime instead.
It comes from [`jubr/bun-slim`](https://github.com/jubr/bun-slim), a patch repository that builds two smaller runtimes from every Bun release.

More about the runtimes, in the `bun-slim` repository:

- [`jubr/bun-slim`](https://github.com/jubr/bun-slim): the repository and its releases.
- [`compiler.md`](https://github.com/jubr/bun-slim/blob/slim/docs/slim/compiler.md): the compiler options of the build.
- [`bun-standalone.md`](https://github.com/jubr/bun-slim/blob/slim/docs/slim/bun-standalone.md): `bun-alone`, Bun's own standalone runtime ([oven-sh/bun#32262](https://github.com/oven-sh/bun/pull/32262)).
- [`bun-slim.md`](https://github.com/jubr/bun-slim/blob/slim/docs/slim/bun-slim.md): `bun-slim`, which trims more.

## Space savings

The last build of `bun-slim`, copied verbatim from its README:

**Latest build: [bun-slim-v1.4.5-0](https://github.com/jubr/bun-slim/releases/tag/bun-slim-v1.4.5-0)** (size of the stripped executable)

| Target | Upstream Bun | `bun-alone` | vs. upstream | `bun-slim` | vs. upstream |
| --- | ---: | ---: | ---: | ---: | ---: |
| linux-x64 | 102.7 MiB | 75.1 MiB | -26.9% | 65.2 MiB | -36.5% |
| linux-arm64 | 102.7 MiB | 73.2 MiB | -28.7% | 62.0 MiB | -39.6% |
| darwin-x64 | 93.3 MiB | 64.9 MiB | -30.4% | 54.4 MiB | -41.7% |
| darwin-arm64 | 85.2 MiB | 55.7 MiB | -34.7% | 47.0 MiB | -44.9% |

The compiled `variant` is the runtime plus about 4 MB of program.
Measured on macOS arm64 with Bun 1.4.5 and `bun-slim-v1.4.5-0`, 1 KB = 1024 bytes:

| Runtime inside `variant` | `variant` | Saved vs. default Bun |
| --- | ---: | ---: |
| Default Bun (`bun-v1.4.5`) | 90,682 KB | – |
| `bun-alone` (`bun-standalone-v1.4.5-0`) | 60,610 KB | 33.2% |
| `bun-slim` (`bun-slim-v1.4.5-0`) | 51,734 KB | 42.9% |

## Which runtime is inside

`variant --version` names the runtime and its version in its last line, between the platform and the repository URL:

```text
macos-arm64, bun-slim-v1.4.5-0, https://github.com/jubr/variant-worktrees
macos-arm64, bun-standalone-v1.4.5-0, https://github.com/jubr/variant-worktrees
macos-arm64, bun-v1.4.5, https://github.com/jubr/variant-worktrees
```

- `bun-slim-v1.4.5-0`: the `bun-slim` runtime, Bun 1.4.5, build 0 of `jubr/bun-slim`.
- `bun-standalone-v1.4.5-0`: the `bun-alone` runtime, Bun's standalone build without the extra trimming.
- `bun-v1.4.5`: the runtime that ships with Bun, `bun-dist` below.
  A Linux or macOS release shows this when no slim runtime could be fetched, and Windows always does.

Run from source under Node, the same line says `node`.
The kind and the version come from the runtime itself, so they show what the executable embeds, not what the build asked for.
[`runtimeToken`](https://github.com/jubr/variant-worktrees/blob/main/packages/variant-api/src/version-line.ts) reads `Bun.version` (the standalone runtimes end it in `-standalone`) and `Bun.Image` (only `bun-slim` lacks it).
The build number is the one thing a runtime does not know: the compile stamps it as `VARIANT_BUILD_RUNTIME` from the release directory the runtime came from, and an executable compiled without it leaves the number off (`bun-slim-v1.4.5`).

## The process

```text
jubr/bun-slim release ──► package:cli (each target) ──► variant executable
 bun-slim-vX.Y.Z-N         VARIANT_BUN_RUNTIME, else     embeds bun-slim,
                           fetch + check zip, else       or bun-dist
                           bun-dist
```

This repository builds no Bun. It fetches a finished runtime when it compiles.

### 1. A Bun version, exactly

[`mise.toml`](https://github.com/jubr/variant-worktrees/blob/main/mise.toml) pins an exact Bun version.
The release job installs it with mise, so the Bun that compiles `variant` is that version and no other.
The slim runtime is picked by the same version.

### 2. The release: `bun-slim-vX.Y.Z-N`

`jubr/bun-slim` publishes one release for each build of a Bun version, such as [`bun-slim-v1.4.5-0`](https://github.com/jubr/bun-slim/releases/tag/bun-slim-v1.4.5-0).
`X.Y.Z` is the Bun version and `N` counts the builds of it.
The release holds a zip per platform for each runtime (`bun-alone-<os>-<arch>-v*.zip`, `bun-slim-<os>-<arch>-v*.zip`) and a `SHA256SUMS`.

### 3. Choose the runtime of each target

[`scripts/package-cli.ts`](https://github.com/jubr/variant-worktrees/blob/main/scripts/package-cli.ts) chooses the runtime for every target it compiles, in `task package:cli`, `task package:cli:all`, `task bleed:cli` and the release jobs, and prints which one it took:

1. **`VARIANT_BUN_RUNTIME`**, when set to an executable.
   It fits one target, so `package:cli:all` refuses it, and a file that is missing or not executable fails before anything is compiled.
2. **The fetched slim runtime**, for a Linux or macOS target.
   [`scripts/bun-slim.ts`](https://github.com/jubr/variant-worktrees/blob/main/scripts/bun-slim.ts) reads the Bun version from `mise.toml`, takes the highest `N` of `bun-slim-v<version>-N` among the releases of `jubr/bun-slim`, downloads `bun-slim-<os>-<arch>-v*.zip` and `SHA256SUMS` with `gh` (it needs `GH_TOKEN` or a `gh` login), checks the zip against the sum and unpacks it.
   [`scripts/fetch-bun-slim.ts`](https://github.com/jubr/variant-worktrees/blob/main/scripts/fetch-bun-slim.ts) does the same by hand and prints the path.
3. **`bun-dist`**, the runtime that ships with Bun.
   Windows has no slim runtime, so it is printed as information.
   Any other target prints a warning with the reason (see below).

The chosen executable goes to `Bun.build` as `compile.executablePath`, so it becomes the runtime inside `variant`.
[`ci-release.yaml`](https://github.com/jubr/variant-worktrees/blob/main/.github/workflows/ci-release.yaml) compiles every `variant` executable in a job of its own with `task package:cli TARGET=<target>` and hands it the token, so it needs no fetch step.

### 4. The fallback

When there is no release for the pinned Bun version, the download fails, or the checksum is wrong, the compile prints a warning (a `::warning::` annotation in GitHub Actions) and embeds `bun-dist`.
`variant --version` then says `bun-v1.4.5`.
A release never fails because the slim runtime is missing.

### 5. Bump the version

```bash
mise x -- task chore:bun:bump
mise x -- task chore:bun:bump VERSION=1.4.6
```

[`scripts/bump-bun.ts`](https://github.com/jubr/variant-worktrees/blob/main/scripts/bump-bun.ts) moves `mise.toml`, the `@types/bun` ranges of the `package.json` files and `bun.lock` to the version of the newest `jubr/bun-slim` release, or to `VERSION`.
It ends with the commit `chore(bun): bump to vX.Y.Z`.
A version without a `bun-slim` release still bumps, and the release falls back to the default runtime until `jubr/bun-slim` publishes one.

## Use it locally

```bash
mise x -- task bleed:cli
```

On Linux and macOS this fetches the slim runtime of the Bun version `mise.toml` pins and prints which runtime it chose.
To embed another runtime, for one platform:

```bash
bun scripts/fetch-bun-slim.ts darwin-arm64
VARIANT_BUN_RUNTIME=<the path it prints> mise x -- task bleed:cli
```

The compiled `variant` keeps the same commands, flags, output and exit codes whichever runtime it embeds.
