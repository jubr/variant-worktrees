#!/usr/bin/env node
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cli } from "cleye";
import {
  LogLevel,
  log,
  platformToken,
  renderVersion,
  repositoryUrl,
  resolveVersionFacts,
  runWatchRelay,
  versionColor,
} from "variant-api";
import { commands, LIFECYCLE_COMMANDS } from "variant-api/commands";
import pkg from "../package.json" with { type: "json" };
import { takeDirectory } from "./chdir.js";
import { CLI_ONLY_COMMANDS, cliOnlyCommands } from "./commands/index.js";
import { lifecycleCommand } from "./commands/lifecycle.js";
import { renderHelp } from "./help.js";
import { takeLogLevel } from "./ipc-log.js";
import { attachLogLevel, explicitSlug, finishCliLog } from "./ipc-vscode.js";
import { GLOBAL_FLAGS, type OutputFormat } from "./output.js";

declare const VARIANT_BUILD_DATE: string | undefined;
declare const VARIANT_BUILD_VARIANT: string | undefined;

/** Stamp captured when this file was bundled. Empty when the CLI runs from source. */
const bakedVersion = (): { date?: string; variant?: string } => ({
  ...(typeof VARIANT_BUILD_DATE === "string" ? { date: VARIANT_BUILD_DATE } : {}),
  ...(typeof VARIANT_BUILD_VARIANT === "string" ? { variant: VARIANT_BUILD_VARIANT } : {}),
});

const { version } = pkg;

/** Takes the global output flags out of the arguments, wherever they stand, and returns the format they ask for. */
const takeFormat = (argv: string[]): { args: string[]; format: OutputFormat } => {
  const asked = GLOBAL_FLAGS.filter(({ name }) => argv.includes(`--${name}`));
  if (asked.length > 1) {
    throw new Error(`Use either ${asked.map(({ name }) => `--${name}`).join(" or ")}, not both.`);
  }
  const flags = GLOBAL_FLAGS.map(({ name }) => `--${name}`);
  return { args: argv.filter((arg) => !flags.includes(arg)), format: (asked[0]?.name ?? "text") as OutputFormat };
};

if (process.argv.includes("--internal-watch-relay")) {
  await runWatchRelay();
} else {
  let servesMcp = false;
  try {
    const { args: withoutDir } = takeDirectory(process.argv.slice(2));
    const { args: withoutLevel, level } = takeLogLevel(withoutDir);
    const { args, format } = takeFormat(withoutLevel);
    const requested = args.find((arg) => !arg.startsWith("-"));
    // AIDEV-NOTE: `variant mcp` owns standard output and its own log sink, so the CLI's sink and its end line stay off.
    servesMcp = requested === "mcp" && !args.includes("--help") && !args.includes("-h");
    if (!servesMcp) {
      const slug = explicitSlug(withoutLevel);
      attachLogLevel(level, { directory: process.cwd(), ...(slug === undefined ? {} : { slug }) });
    }
    const known = (name: string): boolean =>
      commands.some((definition) => definition.name === name) ||
      (CLI_ONLY_COMMANDS as readonly string[]).includes(name);
    if (requested !== undefined && !known(requested)) {
      throw new Error(`Unknown command: ${requested}. Run variant --help for the commands.`);
    }
    if (args.includes("--version") && requested === undefined) {
      const directory = dirname(fileURLToPath(import.meta.url));
      const facts = resolveVersionFacts(directory, new Date(), bakedVersion());
      process.stdout.write(
        renderVersion({
          version,
          platform: platformToken(process.platform, process.arch),
          date: facts.date,
          variant: facts.variant,
          banner: process.stdout.isTTY === true,
          color: versionColor({ isTTY: process.stdout.isTTY === true, NO_COLOR: process.env.NO_COLOR }),
          repository: repositoryUrl(),
        }),
      );
    } else {
      if (!args.includes("--help") && !args.includes("-h")) {
        const name = args.find((arg) => !arg.startsWith("-"));
        if (name !== undefined && name !== "config" && LIFECYCLE_COMMANDS.has(name)) {
          log(LogLevel.info, args.slice(args.indexOf(name)).join(" "));
        }
      }
      await cli(
        {
          name: "variant",
          version,
          help: {
            description: "Database variants for git worktrees",
            render: renderHelp,
          },
          strictFlags: true,
          commands: [...commands.map((definition) => lifecycleCommand(definition, format)), ...cliOnlyCommands()],
        },
        undefined,
        args.length === 0 ? ["--help"] : args,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (!servesMcp) {
      await finishCliLog();
    }
  }
}
