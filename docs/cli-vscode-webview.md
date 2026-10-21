# CLI and VS Code Webview Architecture

CLI, MCP, and VS Code share one `CommandDefinition[]` registry from
`variant-api/commands.ts`.

## Command definitions

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

Commands include `config`, `create`, `list`, `switch`, `provision`, `up`,
`down`, `watch`, and `implode`. Every command takes an optional boolean
`verbose`; `watch` also takes `detach` and `implode` takes `force`. A command
may set `mcpFixed` arguments (`watch` always passes `detach: true` to MCP). Adding
a command updates CLI and MCP registration from the same source.

## CLI

The CLI uses `cleye` to expose each command. Slug commands accept positional
`slug` and `-s`/`--slug`; the flag takes precedence over git detection.

```bash
variant create -s preview-one
variant list
variant provision -s preview-one
variant watch -s preview-one --detach
variant implode preview-one --force
```

An attached `variant watch` sets the process exit code from the result: 130
after an interrupt, 1 when an instance ended or the worktree disappeared.

## MCP

The MCP server converts each argument definition into a Zod input schema and
registers `variant_<command>` tools. Tool handlers call the same
`CommandDefinition.execute` function as the CLI.

## VS Code

The CLI and the MCP server execute `config`, `create`, `list`, `switch`,
`provision`, `up`, `down`, `watch`, and `implode` in `variant-api`. The extension does not. Requests
that need the editor use `{name, args}` on the socket described in
[Editor socket](./guide/ipc).
