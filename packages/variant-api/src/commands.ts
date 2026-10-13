import type { VariantClient } from "./types.js";

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

const slugArg: ArgDefinition = {
  name: "slug",
  description: "Variant slug; defaults to the current git worktree",
  type: "string",
  required: false,
  short: "s",
};

export const commands: CommandDefinition[] = [
  {
    name: "config",
    description: "Print detected variant configuration",
    args: [],
    execute: async (client) => client.config(),
  },
  {
    name: "create",
    description: "Create or refresh a database variant",
    args: [slugArg],
    execute: (client, args) => client.create(args.slug as string | undefined),
  },
  {
    name: "list",
    description: "List known database variants",
    args: [],
    execute: (client) => client.list(),
  },
  {
    name: "switch",
    description: "Switch process context to a variant worktree",
    args: [slugArg],
    execute: (client, args) => client.switch(args.slug as string | undefined),
  },
  {
    name: "provision",
    description: "Run configured variant runtime and seed commands",
    args: [slugArg],
    execute: (client, args) => client.provision(args.slug as string | undefined),
  },
  {
    name: "down",
    description: "Stop the processes and containers of a variant and keep its data",
    args: [slugArg],
    execute: (client, args) => client.down(args.slug as string | undefined),
  },
  {
    name: "implode",
    description: "Stop a variant, drop its database and storage, and remove its state",
    args: [slugArg],
    execute: (client, args) => client.implode(args.slug as string | undefined),
  },
];
