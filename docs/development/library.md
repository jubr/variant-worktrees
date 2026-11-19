# Library

`variant-api` manages variants from TypeScript, on Node.js 22.13 or newer and on Bun.
Each method is the command of the same name: see [Commands](/guide/commands).
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

`init` is [`variant init`](/guide/commands#init).

```ts
const result = await client.init({ prefix: "wt-", mise: false });
console.log(result.file, result.gitignore.status, result.detected?.dialect);
```

## Lifecycle

Create, provision and list; see [`create`](/guide/commands#create) and [`provision`](/guide/commands#provision).

```ts
await client.create("preview-one"); // starts at variant.baseBranch
await client.create("other", { from: "feat/other" });
await client.create("fresh", { pullFf: true }); // fast-forward the start branch first
await client.provision("preview-one");
const variants = await client.list();
```

Run, stop and remove; see [`watch`](/guide/commands#watch), [`down`](/guide/commands#down) and [`implode`](/guide/commands#implode).

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

- [`variant.watches`](/guide/configuration#variant-watches): what `watch` and `up` start
- [`variant.steps`](/guide/configuration#variant-steps): what `provision` and `seed` run
- [`variant.mise`](/guide/configuration#variant-mise): how Mise provides the environment
- [`variant.baseBranch`](/guide/configuration#variant-basebranch): where a new variant branch starts
- [Database](/guide/configuration#database-options): [`db.dialect`](/guide/configuration#db-dialect), host, port and the rest of the connection

Every option is in [Configuration](/guide/configuration#variant-options), and what watches do at run time is in [Runtime](/guide/runtime).

## Command definitions

The CLI, the MCP server and the editor share one `CommandDefinition[]` registry from `variant-api/commands.ts`.

```typescript
export interface ArgDefinition {
  name: string;
  description: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  short?: string;
}

export interface CommandDefinition {
  name: keyof VariantClient;
  description: string;
  args: ArgDefinition[];
  execute: (client: VariantClient, args: Record<string, unknown>) => Promise<unknown>;
}
```

Commands include `config`, `create`, `list`, `provision`, `up`, `down`, `watch`, and `implode`.

- Every command takes an optional boolean `verbose`.
- `watch` also takes `detach`, and `implode` takes `force` and the choice `branchRm` (`yes` or `no`, default `yes`).
- A command may set `mcpFixed` arguments: `watch` always passes `detach: true` to MCP.
- Adding a command updates the CLI and MCP registration from the same source.
- The MCP server converts each argument definition into a Zod input schema and registers `variant_<command>` tools.
- Tool handlers call the same `CommandDefinition.execute` function as the CLI.
- Requests that need the editor use `{name, args}` on the socket described in [Socket IPC](/vscode/socket-ipc).

## Elsewhere

The same operations are tools of the [MCP Server](/vscode/mcp), and the [Extension](/vscode/extension) runs them from the editor.
