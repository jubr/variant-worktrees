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
await client.switch("preview-one");
await client.destroy("preview-one");
```

`create` and `destroy` are idempotent for isolated variants. The `main`
variant is protected from destruction.

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

Use `variant.instances` for explicit Vite/NestJS directories, keyed by instance name (the key is the
name in runtime state, templates such as `{{port.be}}` and the `VARIANT_<KEY>_PORT` / `_URL` / `_PID`
environment overrides, so `VARIANT_BE_PORT=62099` pins the port of `be`). `open` is a URL template
with `{{slug}}` and `{{port}}` placeholders; `dotenv` names an env file, relative to `dir`, that is
copied for a variant and amended with its values. The port is `VARIANT_<KEY>_PORT`, else `runtime.instances.<key>.port`
from the git-ignored `variants.local.yaml` in the variant's worktree, otherwise a random free
port that is not in `variant.reservedPorts` (default 3000, 4200, 5432). If `variant.instances` is omitted, subdirectories below the configuration file are
searched automatically.
