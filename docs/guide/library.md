# Library

Use `variant-api` to manage isolated database variants from TypeScript.

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

await client.up("preview-one"); // instances as containers, on a fresh database
const watched = await client.watch("preview-one", { detach: true }); // host processes
await client.down("preview-one"); // stop what runs, keep the data
await client.implode("preview-one"); // tear down and remove the worktree
```

`create` is idempotent for isolated variants. `implode` replaces the former
`destroy`: it refuses `main`, refuses work that is not merged into
`variant.baseBranch` unless `{ force: true }`, and resolves with the removed
worktree and the report of what it held. An attached `watch` (no `detach`)
resolves with an `exitCode` when it ends: 130 after an interrupt (pass an
`AbortSignal` as `signal`), 1 when an instance ended or the worktree vanished.
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
  up: bun run db:migrate
  watch: bun run dev
  seed: bun run db:seed
  instances:
    fe:
      kind: vite
      dir: fe
      open: http://{{slug}}.vw.localhost:{{port}}
    be:
      kind: nestjs
      dir: be
```

::: v-pre

Use `variant.instances` for explicit Vite/NestJS directories, keyed by instance name (the key is the
name in runtime state, templates such as `{{port.be}}` and the `VARIANT_<KEY>_PORT` / `_URL` / `_PID`
environment overrides, so `VARIANT_BE_PORT=62099` pins the port of `be`). `open` is a URL template
with `{{slug}}` and `{{port}}` placeholders; `dotenv` names an env file, relative to `dir`, that is
copied for a variant and amended with its values. The port is `VARIANT_<KEY>_PORT`, else `runtime.instances.<key>.port`
from the git-ignored `variants.local.yaml` in the variant's worktree, otherwise a random free
port that is not in `variant.reservedPorts` (default 3000, 4200, 5432). If `variant.instances` is omitted, subdirectories below the configuration file are
searched automatically.

:::
