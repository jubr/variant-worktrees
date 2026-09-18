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

Commands include `config`, `create`, `destroy`, `list`, `switch`, and
`provision`. Adding a command updates CLI and MCP registration from the same
source.

## CLI

The CLI uses `cleye` to expose each command. Slug commands accept positional
`slug` and `-s`/`--slug`; the flag takes precedence over git detection.

```bash
variant create -s preview-one
variant list
variant provision -s preview-one
```

## MCP

The MCP server converts each argument definition into a Zod input schema and
registers `variant_<command>` tools. Tool handlers call the same
`CommandDefinition.execute` function as the CLI.

## VS Code

The extension can render one webview form per command by iterating over
`cmd.args`, mapping each argument to a VS Code input field, and posting
`{ command: cmd.name, args }` back to the extension. The extension then calls
the shared command definition and posts the result or error to the webview.

This keeps argument labels, required fields, and command execution behavior
consistent across interfaces.
