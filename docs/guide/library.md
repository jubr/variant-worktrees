# Library

`variant-api` manages variants from TypeScript, on Node.js 22.13 or newer and on Bun.
Each method is the command of the same name: see [Core](./core).
Install it from a checkout: [Development](/development/building).

## Quick start

A client reads `variants.yaml` and the environment as Mise prints it.

```ts
import { createVariantClient } from "variant-api";

const client = createVariantClient();
const variant = await client.create("preview-one");
console.log(variant.target);
```

Options for a client without a worktree, or with a Mise that is not on `PATH`:

```ts
const dbOnly = createVariantClient({ worktree: false });
const custom = createVariantClient({ miseBinPath: "/opt/tools/mise" });
```

## Bootstrap

`init` is [`variant init`](./core#init).

```ts
const result = await client.init({ prefix: "wt-", mise: false });
console.log(result.file, result.gitignore.status, result.detected?.dialect);
```

## Lifecycle

Create, provision and list; see [`create`](./core#create) and [`provision`](./core#provision).

```ts
await client.create("preview-one"); // starts at variant.baseBranch
await client.create("other", { from: "feat/other" });
await client.create("fresh", { pullFf: true }); // fast-forward the start branch first
await client.provision("preview-one");
const variants = await client.list();
```

Run, stop and remove; see [`watch`](./core#watch), [`down`](./core#down) and [`implode`](./core#implode).

```ts
await client.up("preview-one"); // watches as containers, on a fresh database
const watched = await client.watch("preview-one", { detach: true }); // host processes
await client.down("preview-one"); // stop what runs, keep the data
await client.implode("preview-one"); // tear down, remove the worktree, then the local branch
await client.implode("preview-one", { branchRm: "no" }); // keep the local branch
await client.implode("preview-one", { force: true }); // even when not merged
```

Install Mise tools in a new worktree: `"bg"`, `"sync"` or `"no"`.

```ts
await client.create("preview-one", { miseInstall: "bg" });
await client.provision("preview-one", { miseInstall: "sync" });
```

An attached `watch` resolves with an `exitCode` when it ends; pass an `AbortSignal` to stop it.

```ts
const controller = new AbortController();
const attached = await client.watch("preview-one", { signal: controller.signal });
console.log(attached.exitCode); // 130 after an interrupt, 1 when a watch ended
```

## Configuration

The same `variants.yaml` serves the CLI, the library and the editor.
The options a caller meets first:

- [`variant.watches`](./configuration#variant-watches): what `watch` and `up` start
- [`variant.steps`](./configuration#variant-steps) and [`variant.seed`](./configuration#variant-seed): what `provision` and `seed` run
- [`variant.mise`](./configuration#variant-mise): how Mise provides the environment
- [`variant.baseBranch`](./configuration#variant-basebranch): where a new variant branch starts
- [Database](./configuration#database-options): [`db.dialect`](./configuration#db-dialect), host, port and the rest of the connection

Every option is in [Configuration](./configuration#variant-options), and what watches do at run time is in [Runtime](./runtime).

## Elsewhere

The same operations are tools of the [MCP Server](/mcp), and the [Extension](./extension) runs them from the editor.
Every export is in the [API Reference](/api/).
