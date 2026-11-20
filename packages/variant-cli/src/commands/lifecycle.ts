import { command } from "cleye";
import { createVariantClient, type WatchResult } from "variant-api";
import type { CommandDefinition } from "variant-api/commands";
import { renderHelp } from "../help.js";
import { migrateConfigFiles } from "../migration.js";
import { type OutputFormat, renderOutput, stdoutColor } from "../output.js";
import { printWarnings } from "../warnings.js";
import { collectArgs } from "./args.js";
import { flagSpecsFor } from "./flags.js";

const flagTypes = { string: String, number: Number, boolean: Boolean } as const;

const flagsFor = (definition: CommandDefinition) =>
  Object.fromEntries(
    flagSpecsFor(definition).map((flag) => [
      flag.name,
      {
        type: flagTypes[flag.type],
        ...(flag.short ? { alias: flag.short } : {}),
        description: flag.description,
      },
    ]),
  );

/** One cleye command for a library command definition: it runs `execute()` in-process and prints the rendered result. */
export const lifecycleCommand = (definition: CommandDefinition, format: OutputFormat) =>
  command(
    {
      name: String(definition.name),
      help: { description: definition.description, render: renderHelp },
      parameters: definition.args.some((arg) => arg.name === "slug") ? ["[slug]"] : [],
      flags: flagsFor(definition),
    },
    async (argv) => {
      const flags = argv.flags as Record<string, unknown>;
      const positional = (argv._ as unknown as { slug?: string }).slug;
      const args = collectArgs(definition, flags, positional);
      const client = createVariantClient({ worktree: process.env.VARIANT_WORKTREE !== "0" });
      printWarnings(client.config().warnings);
      migrateConfigFiles(client.config());
      const rendered = {
        format,
        variantRoot: client.config().variant.root,
        verbose: flags.verbose === true,
        color: stdoutColor(process.stdout, process.env),
      };
      let printedStart = false;
      if (definition.name === "watch" && format === "text" && args.detach !== true) {
        args.onStarted = (started: WatchResult) => {
          printedStart = true;
          console.log(renderOutput("watch", started, rendered));
        };
      }
      const result = await definition.execute(client, args);
      if (printedStart) {
        const exitCode = (result as { exitCode?: unknown } | undefined)?.exitCode;
        if (typeof exitCode === "number" && exitCode !== 0) {
          console.log(`exit code:  ${exitCode}`);
        }
      } else {
        console.log(renderOutput(String(definition.name), result, rendered));
      }
      const exitCode = (result as { exitCode?: unknown } | undefined)?.exitCode;
      if (typeof exitCode === "number" && exitCode !== 0) {
        process.exitCode = exitCode;
      }
    },
  );
