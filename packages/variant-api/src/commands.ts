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
  /** Arguments the MCP tool always passes; they are not offered as tool inputs. */
  mcpFixed?: Record<string, unknown>;
}

const slugArg: ArgDefinition = {
  name: "slug",
  description: "Variant slug; defaults to the current git worktree",
  type: "string",
  required: false,
  short: "s",
};

const verboseArg: ArgDefinition = {
  name: "verbose",
  description: "Print the full output of quiet provisioning steps",
  type: "boolean",
  required: false,
};

const slugString = (args: Record<string, unknown>): string | undefined => args.slug as string | undefined;
const verbose = (args: Record<string, unknown>): { verbose?: boolean } =>
  args.verbose === undefined ? {} : { verbose: args.verbose === true };

export const commands: CommandDefinition[] = [
  {
    name: "config",
    description: "Print detected variant configuration",
    args: [verboseArg],
    execute: async (client) => client.config(),
  },
  {
    name: "create",
    description: "Create or refresh a database variant",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.create(slugString(args)),
  },
  {
    name: "list",
    description: "List known database variants",
    args: [verboseArg],
    execute: (client) => client.list(),
  },
  {
    name: "switch",
    description: "Switch process context to a variant worktree",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.switch(slugString(args)),
  },
  {
    name: "provision",
    description: "Run configured variant runtime and seed commands",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.provision(slugString(args), verbose(args)),
  },
  {
    name: "up",
    description: "Run the instances of a variant as containers on a fresh database",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.up(slugString(args), verbose(args)),
  },
  {
    name: "down",
    description: "Stop the processes and containers of a variant and keep its data",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.down(slugString(args)),
  },
  {
    name: "watch",
    description: "Run the instances of a variant as supervised host processes",
    args: [
      slugArg,
      {
        name: "detach",
        description: "Start the processes in the background and return",
        type: "boolean",
        required: false,
      },
      verboseArg,
    ],
    execute: (client, args) =>
      client.watch(slugString(args), {
        ...verbose(args),
        ...(args.detach === undefined ? {} : { detach: args.detach === true }),
      }),
    mcpFixed: { detach: true },
  },
  {
    name: "implode",
    description: "Stop a variant, drop its database and storage, and remove its state and worktree",
    args: [
      slugArg,
      {
        name: "force",
        description: "Implode work that is not merged and a worktree with local changes",
        type: "boolean",
        required: false,
      },
      verboseArg,
    ],
    execute: (client, args) =>
      client.implode(slugString(args), args.force === undefined ? {} : { force: args.force === true }),
  },
];
