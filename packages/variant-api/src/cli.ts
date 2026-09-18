#!/usr/bin/env node
import { cli, command } from "cleye";
import { type CommandDefinition, commands } from "./commands.js";
import { createClient } from "./index.js";

const redacted = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redacted);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    copy[key] = key === "password" && child ? "***" : redacted(child);
  }
  return copy;
};

const runCommand = (definition: CommandDefinition) =>
  command(
    {
      name: String(definition.name),
      parameters: definition.args.some((arg) => arg.name === "slug") ? ["[slug]"] : [],
      flags: definition.args.some((arg) => arg.name === "slug")
        ? {
            slug: {
              type: String,
              alias: "s",
              description: "Explicit variant slug; overrides git detection",
            },
          }
        : {},
    },
    async (argv) => {
      const positional = (argv._ as unknown as { slug?: string }).slug;
      const flags = argv.flags as { slug?: string };
      const explicit = flags.slug ?? positional;
      const client = createClient();
      const result = await definition.execute(client, explicit === undefined ? {} : { slug: explicit });
      console.log(JSON.stringify(redacted(result), null, 2));
    },
  );

try {
  await cli({
    name: "variant",
    version: "0.0.1",
    help: {
      description: "Database variants for git worktrees",
    },
    strictFlags: true,
    commands: commands.map(runCommand),
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
