# Library

Use `variant-api` to manage isolated database variants from TypeScript. It runs on Node.js 22.13 or newer and on Bun, and provides no command line: the `variant` command comes from the `variant-cli` package.

## Quick start

```ts
import { createClient } from "variant-api";

const client = createClient();
const variant = await client.create("preview-one");
console.log(variant.target);
```

The client resolves configuration from `variants.yaml`, then
`mise.local.toml`, then environment variables. Pass `worktree: false` when
database-only behavior is required.

## Lifecycle

```ts
await client.create("preview-one");
await client.provision("preview-one");
const variants = await client.list();

await client.up("preview-one"); // watches as containers, on a fresh database
const watched = await client.watch("preview-one", { detach: true }); // host processes
await client.down("preview-one"); // stop what runs, keep the data
await client.implode("preview-one"); // tear down and remove the worktree
```

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
      url: http://{{slug}}.vw.localhost:{{port}}
    be:
      kind: nestjs
      dir: be
      up: bun run db:migrate
      watch: bun run start:dev
```

::: v-pre

Use `variant.watches` for explicit Vite/NestJS directories, keyed by watch name (the key is the
name in runtime state, templates such as `{{be.port}}` and the `VARIANT_<KEY>_PORT` / `_URL` / `_PID`
environment overrides, so `VARIANT_BE_PORT=62099` pins the port of `be`). `url` is a URL template
with `{{slug}}` and `{{port}}` placeholders; `env.sourceFile` names an env file, relative to `dir`, that is
copied for a variant and amended with `env.overrides`. The port is `VARIANT_<KEY>_PORT`, else `runtime.watches.<key>.port`
from the git-ignored `variants.local.yaml` in the variant's worktree, otherwise a random free
port of `variant.ports.range` (default `42000-42999`). If `variant.watches` is omitted, subdirectories below the configuration file are
searched automatically.

:::
