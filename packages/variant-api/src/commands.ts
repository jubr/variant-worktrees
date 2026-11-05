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

const fromArg: ArgDefinition = {
  name: "from",
  description: "Commit, tag, or branch a new variant branch starts at. Omitted, it starts at variant.baseBranch",
  type: "string",
  required: false,
};

const verboseArg: ArgDefinition = {
  name: "verbose",
  description: "Print the full output of quiet provisioning steps; for list, all meta information of every variant",
  type: "boolean",
  required: false,
  short: "v",
};

const slugString = (args: Record<string, unknown>): string | undefined => args.slug as string | undefined;
const verbose = (args: Record<string, unknown>): { verbose?: boolean } =>
  args.verbose === undefined ? {} : { verbose: args.verbose === true };
const fromOf = (args: Record<string, unknown>): { from?: string } =>
  typeof args.from === "string" ? { from: args.from } : {};

const stepArg = (name: string, description: string): ArgDefinition => ({
  name,
  description: `${description}; on unless turned off with --${name}=false`,
  type: "boolean",
  required: false,
});

const initSteps = ["file", "gitignore", "mise"] as const;

export const commands: CommandDefinition[] = [
  {
    name: "init",
    description: "Bootstrap the directory: variants.yaml from autodetection, the .gitignore line and the Mise entry",
    args: [
      { name: "prefix", description: "Worktree directory prefix, default _v-", type: "string", required: false },
      stepArg("file", "Write variants.yaml"),
      stepArg("gitignore", "Add the worktree pattern to .gitignore"),
      stepArg("mise", "Add the variant CLI to the Mise configuration"),
      {
        name: "force",
        description: "Replace the variants.yaml of this directory when it exists",
        type: "boolean",
        required: false,
      },
    ],
    execute: (client, args) =>
      client.init({
        ...(args.prefix === undefined ? {} : { prefix: args.prefix as string }),
        ...Object.fromEntries(
          initSteps.filter((step) => args[step] !== undefined).map((step) => [step, args[step] === true]),
        ),
        ...(args.force === undefined ? {} : { force: args.force === true }),
      }),
  },
  {
    name: "config",
    description: "Print detected variant configuration",
    args: [verboseArg],
    execute: async (client) => client.config(),
  },
  {
    name: "create",
    description: "Create or refresh a database variant",
    args: [slugArg, fromArg, verboseArg],
    execute: (client, args) => client.create(slugString(args), fromOf(args)),
  },
  {
    name: "list",
    description: "List known database variants",
    args: [verboseArg],
    execute: (client, args) => client.list(verbose(args)),
  },
  {
    name: "status",
    description: "Show everything known about one variant: its runtime state, uptime and watch log file",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.status(slugString(args)),
  },
  {
    name: "provision",
    description: "Run configured variant runtime and seed commands",
    args: [slugArg, fromArg, verboseArg],
    execute: (client, args) => client.provision(slugString(args), { ...verbose(args), ...fromOf(args) }),
  },
  {
    name: "up",
    description: "Run the watches of a variant as containers",
    args: [slugArg, fromArg, verboseArg],
    execute: (client, args) => client.up(slugString(args), { ...verbose(args), ...fromOf(args) }),
  },
  {
    name: "down",
    description: "Stop the processes and containers of a variant and keep its data",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.down(slugString(args)),
  },
  {
    name: "deprovision",
    description: "Stop a variant and drop its schemas. A deprovision script replaces the drop",
    args: [slugArg, verboseArg],
    execute: (client, args) => client.deprovision(slugString(args), verbose(args)),
  },
  {
    name: "watch",
    description: "Run the watches of a variant as supervised host processes",
    args: [
      slugArg,
      fromArg,
      {
        name: "detach",
        description: "Start the processes in the background and return",
        type: "boolean",
        required: false,
      },
      {
        name: "reprovision",
        description: "Drop the schemas before provisioning again",
        type: "boolean",
        required: false,
      },
      verboseArg,
    ],
    execute: (client, args) =>
      client.watch(slugString(args), {
        ...verbose(args),
        ...fromOf(args),
        ...(args.detach === undefined ? {} : { detach: args.detach === true }),
        ...(args.reprovision === undefined ? {} : { reprovision: args.reprovision === true }),
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
