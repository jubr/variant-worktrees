import { LOG_LEVELS } from "variant-log";
import type { VariantClient, WatchResult } from "./types.js";

/** Command names the extension socket refuses. The views call these in-process. */
export const LIFECYCLE_COMMANDS = new Set(["config", "create", "list", "provision", "up", "down", "watch", "implode"]);

/** The shared log levels, as a set the socket can test a request against. */
export const LEVELS = new Set<string>(LOG_LEVELS);

export interface ArgDefinition {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "choice";
  required: boolean;
  short?: string;
  /** Allowed tokens when `type` is `choice`. A two-token choice uses `yes` and `no`. */
  values?: readonly string[];
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

const pullFfArg: ArgDefinition = {
  name: "pullFf",
  description:
    "Fast-forward the start branch before a new variant branch is created. A conflict or other error leaves that checkout un-pulled",
  type: "boolean",
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
const pullFfOf = (args: Record<string, unknown>): { pullFf?: boolean } =>
  args.pullFf === true ? { pullFf: true } : {};

const miseInstallArg: ArgDefinition = {
  name: "miseInstall",
  description:
    "Install Mise tools in the worktree: bg, sync, or no. Omit to install in the background when the worktree has a Mise config",
  type: "string",
  required: false,
};

const miseInstallOf = (args: Record<string, unknown>): { miseInstall: "bg" | "sync" | "no" } => {
  const value = args.miseInstall ?? "bg";
  if (value !== "bg" && value !== "sync" && value !== "no") {
    throw new Error(`miseInstall must be bg, sync, or no, not ${String(value)}`);
  }
  return { miseInstall: value };
};

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
    args: [slugArg, fromArg, pullFfArg, miseInstallArg, verboseArg],
    execute: (client, args) =>
      client.create(slugString(args), { ...fromOf(args), ...pullFfOf(args), ...miseInstallOf(args) }),
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
    args: [slugArg, fromArg, pullFfArg, miseInstallArg, verboseArg],
    execute: (client, args) =>
      client.provision(slugString(args), {
        ...verbose(args),
        ...fromOf(args),
        ...pullFfOf(args),
        ...miseInstallOf(args),
      }),
  },
  {
    name: "up",
    description: "Run the watches of a variant as containers",
    args: [slugArg, fromArg, pullFfArg, verboseArg],
    execute: (client, args) => client.up(slugString(args), { ...verbose(args), ...fromOf(args), ...pullFfOf(args) }),
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
      pullFfArg,
      miseInstallArg,
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
        ...pullFfOf(args),
        ...miseInstallOf(args),
        ...(args.detach === undefined ? {} : { detach: args.detach === true }),
        ...(args.reprovision === undefined ? {} : { reprovision: args.reprovision === true }),
        ...(typeof args.onStarted === "function" ? { onStarted: args.onStarted as (result: WatchResult) => void } : {}),
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
      {
        name: "branchRm",
        description: "Remove the local branch after the worktree: yes or no. Default yes",
        type: "choice",
        values: ["yes", "no"],
        required: false,
      },
      verboseArg,
    ],
    execute: (client, args) =>
      client.implode(slugString(args), {
        ...(args.force === undefined ? {} : { force: args.force === true }),
        ...(args.branchRm === undefined ? {} : { branchRm: args.branchRm as "yes" | "no" }),
      }),
  },
];
