import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { collectArgs } from "../src/cli-args.js";
import { type CommandDefinition, commands } from "../src/commands.js";
import type { VariantClient } from "../src/types.js";

const definition = (name: string): CommandDefinition => {
  const found = commands.find((command) => command.name === name);
  if (!found) {
    throw new Error(`no command ${name}`);
  }
  return found;
};

/** A client whose methods record how they were called. */
const recordingClient = (): { client: VariantClient; calls: [string, ...unknown[]][] } => {
  const calls: [string, ...unknown[]][] = [];
  const client = new Proxy({} as Record<string, unknown>, {
    get:
      (_target, name: string) =>
      (...args: unknown[]) => {
        calls.push([name, ...args]);
        return Promise.resolve({ slug: args[0] });
      },
  }) as unknown as VariantClient;
  return { client, calls };
};

describe("command registry", () => {
  it("contains the lifecycle, runtime and config commands and no destroy", () => {
    expect(commands.map((command) => command.name)).toEqual([
      "config",
      "create",
      "list",
      "switch",
      "provision",
      "up",
      "down",
      "watch",
      "implode",
    ]);
    expect(commands.some((command) => String(command.name) === "destroy")).toBe(false);
  });

  it("declares an optional short slug flag for slug commands", () => {
    for (const command of commands.filter((entry) => entry.name !== "config" && entry.name !== "list")) {
      expect(command.args[0]).toMatchObject({
        name: "slug",
        required: false,
        short: "s",
      });
    }
  });

  it("gives every command an optional boolean verbose argument", () => {
    for (const command of commands) {
      expect(command.args).toContainEqual(
        expect.objectContaining({ name: "verbose", type: "boolean", required: false }),
      );
    }
  });

  it("gives watch a detach argument and implode a force argument", () => {
    expect(definition("watch").args).toContainEqual(expect.objectContaining({ name: "detach", type: "boolean" }));
    expect(definition("implode").args).toContainEqual(expect.objectContaining({ name: "force", type: "boolean" }));
  });

  it("routes create through the client", async () => {
    const client = {
      create: (slug?: string) => Promise.resolve({ slug }),
    } as unknown as VariantClient;
    const result = await commands
      .find((command) => command.name === "create")
      ?.execute(client, { slug: "test-feature" });
    expect(result).toEqual({ slug: "test-feature" });
  });

  it("hands the options of each command to the client method of the same name", async () => {
    const { client, calls } = recordingClient();

    await definition("watch").execute(client, { slug: "demo", detach: true });
    await definition("implode").execute(client, { slug: "demo", force: true });
    await definition("provision").execute(client, { slug: "demo", verbose: true });
    await definition("up").execute(client, { slug: "demo", verbose: true });
    await definition("down").execute(client, { slug: "demo" });

    expect(calls).toEqual([
      ["watch", "demo", { detach: true }],
      ["implode", "demo", { force: true }],
      ["provision", "demo", { verbose: true }],
      ["up", "demo", { verbose: true }],
      ["down", "demo"],
    ]);
  });

  it("always detaches watch for MCP", () => {
    expect(definition("watch").mcpFixed).toEqual({ detach: true });
  });

  it("is not wired to the editor socket in the CLI or the MCP server", () => {
    const sources = ["src/cli.ts", "src/commands.ts", "src/index.ts", "../variant-mcp/src/mcp.ts"]
      .map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))
      .join("\n");

    expect(sources).not.toContain("variant-ipc");
  });
});

describe("command line arguments", () => {
  it("passes --detach and --slug to watch", () => {
    expect(collectArgs(definition("watch"), { slug: "demo", detach: true })).toEqual({ slug: "demo", detach: true });
  });

  it("takes the slug of implode from the positional argument", () => {
    expect(collectArgs(definition("implode"), { force: true }, "demo")).toEqual({ slug: "demo", force: true });
  });

  it("passes --verbose to provision", () => {
    expect(collectArgs(definition("provision"), { verbose: true })).toEqual({ verbose: true });
  });

  it("leaves out flags that were not given", () => {
    expect(collectArgs(definition("watch"), { detach: undefined, slug: undefined })).toEqual({});
  });
});
