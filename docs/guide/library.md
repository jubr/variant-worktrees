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
    - name: fe
      kind: vite
      dir: packages/example-fe
      open: http://{{slug}}.vw.localhost:{{port}}
    - name: be
      kind: nestjs
      dir: packages/example-be
```

Use `variant.instances` for explicit Vite/NestJS directories. `open` is a URL template
with `{{slug}}` and `{{port}}` placeholders and is only valid on Vite instances. The port
is the one assigned in `.cache/variants/<slug>.yaml` (`spa_port` for Vite, `api_port` for
NestJS; the directory is `variant.cacheDir`), otherwise a random free port. If omitted,
subdirectories below the configuration file are searched automatically.
