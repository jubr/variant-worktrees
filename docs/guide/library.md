# Library

Use `variant-api` to manage isolated database variants from TypeScript. It runs on Node.js 22.13 or newer and on Bun, and provides no command line: the `variant` command comes from the `variant-cli` package.

## Quick start

```ts
import { createClient } from "variant-api";

const client = createClient();
const variant = await client.create("preview-one");
console.log(variant.target);
```

The client resolves configuration from `variants.yaml`, then the environment as
`mise env` prints it (merged over the process environment, read lazily and once), so
`mise.local.toml` and the like keep working. Pass `worktree: false` when
database-only behavior is required, and `miseBinPath` to name a Mise executable that is not on `PATH`.

## Bootstrap

```ts
const result = await client.init({ prefix: "wt-", mise: false });
console.log(result.file, result.gitignore.status, result.detected?.dialect);
```

`init` writes `variants.yaml` from autodetection (secrets as `${NAME}` references), adds `<prefix>*` to `.gitignore` and adds the CLI to the Mise configuration; `file`, `gitignore` and `mise` are on unless `false`, and `force` replaces an existing `variants.yaml` of the directory. A failing Mise step is reported in `result.mise` and stops no other step. `loadVariantConfig`, `augmentMiseConfig`, `miseEnvironment`, `readVariableSources` and `runMiseTrust` are exported for callers that run Mise themselves.

## Lifecycle

```ts
await client.create("preview-one"); // starts at variant.baseBranch
await client.create("other", { from: "feat/other" });
await client.create("fresh", { pullFf: true }); // fast-forward the start branch first
await client.provision("preview-one");
const variants = await client.list();

await client.up("preview-one"); // watches as containers, on a fresh database
const watched = await client.watch("preview-one", { detach: true }); // host processes
await client.down("preview-one"); // stop what runs, keep the data
await client.implode("preview-one"); // tear down, remove the worktree, then the local branch
await client.implode("preview-one", { branchRm: "no" }); // keep the local branch
```

`create(slug, { from })`, and the `from` option of `provision`, `up`, and `watch`, start a new branch at that commit, tag, or branch. Omit `from` and the branch starts at `variant.baseBranch`. An existing worktree is not moved. `implode` still requires a merge into `variant.baseBranch`.

`pullFf: true` on those four methods fast-forwards the start branch before a new variant branch is created. It does not pull the new branch. The start branch is `from` when that names a local branch, and `variant.baseBranch` otherwise. A tag, a commit, a remote-tracking name, or `HEAD` is used as given, with no fetch. A dry-run that predicts a conflict, divergence, a missing upstream, or another error leaves that checkout un-pulled. When the update fails after a clean dry-run, the checkout is restored and the error includes the command to run again. Omit `pullFf` and nothing is fetched. An existing worktree, an existing prefixed branch, and slug `main` skip the network.

`miseInstall` on `create`, `provision`, and `watch` is `"bg"`, `"sync"`, or `"no"`. Omit it and the value is `"bg"`. The install runs only when the worktree has a Mise config, and only from `create`; `provision` and `watch` pass the option through. `up` does not take it, and there is no configuration-file key. The run is `trust --all`, then `install`, in the worktree. `"bg"` returns immediately and writes `{worktree}/.cache/variant/mise-install.log`. `"sync"` waits and fails the call when Mise fails; the worktree stays. Slug `main` and a create that makes no worktree skip it.

`create` is idempotent for isolated variants. `implode` replaces the former
`destroy`: it refuses `main`, refuses work that is not merged into
`variant.baseBranch` unless `{ force: true }`, and resolves with the removed
worktree and the report of what it held. An attached `watch` (no `detach`)
resolves with an `exitCode` when it ends: 130 after an interrupt (pass an
`AbortSignal` as `signal`), 1 when a watch ended or the worktree vanished.
`up` and `watch` accept `opener` and `log` to replace the browser launcher and
the stderr progress lines.

The commands are in [Core](./core). Templates and every option are in
[Configuration](./configuration).

## Configuration

```yaml
db:
  dialect: postgres
  host: 127.0.0.1
  port: 5432
  database: variants
variant:
  seed: bun run db:seed
  watches:
    fe:
      kind: vite
      dir: fe
      watch: bun run dev
      url: http://${slug}.vw.localhost:${port}
    be:
      kind: nestjs
      dir: be
      up: bun run db:migrate
      watch: bun run start:dev
```

::: v-pre

Use `variant.watches` for explicit Vite/NestJS directories, keyed by watch name (the key is the
name in runtime state, templates such as `${be.port}` and the `VARIANT_<KEY>_PORT` / `_URL` / `_PID`
environment overrides, so `VARIANT_BE_PORT=62099` pins the port of `be`). `url` is a URL template
with `${slug}` and `${port}` placeholders; `env.sourceFile` names an env file, relative to `dir`, that is
copied for a variant and amended with `env.overrides`. The port is `VARIANT_<KEY>_PORT`, else `runtime.watches.<key>.port`
from `<variant>/.cache/variant/state.yaml` (or a legacy `variants.local.yaml` when that file is absent), otherwise a free
port of `variant.ports.range` (default `42000-42999`). If `variant.watches` is omitted, subdirectories below the configuration file are
searched automatically.

:::
