import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { type CommandDefinition, commands, LEVELS, LIFECYCLE_COMMANDS } from "./commands.js";
import type { VariantClient } from "./types.js";

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

describe("socket command names", () => {
  it("lists the lifecycle commands the socket refuses and the shared levels", () => {
    expect([...LIFECYCLE_COMMANDS]).toEqual([
      "config",
      "create",
      "list",
      "provision",
      "up",
      "down",
      "watch",
      "implode",
    ]);
    expect([...LEVELS]).toEqual(["trace", "debug", "info", "warn", "error"]);
  });
});

describe("command registry", () => {
  it("contains the lifecycle, runtime and config commands and no destroy or switch", () => {
    expect(commands.map((command) => command.name)).toEqual([
      "init",
      "config",
      "create",
      "list",
      "status",
      "provision",
      "up",
      "down",
      "deprovision",
      "watch",
      "implode",
    ]);
    expect(commands.some((command) => String(command.name) === "destroy")).toBe(false);
    expect(commands.some((command) => String(command.name) === "switch")).toBe(false);
  });

  it("declares an optional short slug flag for slug commands", () => {
    for (const command of commands.filter(
      (entry) => entry.name !== "init" && entry.name !== "config" && entry.name !== "list",
    )) {
      expect(command.args[0]).toMatchObject({
        name: "slug",
        required: false,
        short: "s",
      });
    }
  });

  it("gives every command but init an optional boolean verbose argument", () => {
    for (const command of commands.filter((entry) => entry.name !== "init")) {
      expect(command.args).toContainEqual(
        expect.objectContaining({ name: "verbose", type: "boolean", required: false }),
      );
    }
  });

  it("gives watch a detach argument and implode a force argument", () => {
    expect(definition("watch").args).toContainEqual(expect.objectContaining({ name: "detach", type: "boolean" }));
    expect(definition("watch").args).toContainEqual(expect.objectContaining({ name: "reprovision", type: "boolean" }));
    expect(definition("deprovision").args[0]).toMatchObject({ name: "slug", required: false });
    expect(definition("implode").args).toContainEqual(expect.objectContaining({ name: "force", type: "boolean" }));
  });

  it("routes list through the client with the verbose option", async () => {
    const { client, calls } = recordingClient();

    await definition("list").execute(client, {});
    await definition("list").execute(client, { verbose: true });

    expect(calls).toEqual([
      ["list", {}],
      ["list", { verbose: true }],
    ]);
  });

  it("routes status through the client with the slug", async () => {
    const { client, calls } = recordingClient();

    await definition("status").execute(client, { slug: "demo" });

    expect(calls).toEqual([["status", "demo"]]);
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
      ["watch", "demo", { detach: true, miseInstall: "bg" }],
      ["implode", "demo", { force: true }],
      ["provision", "demo", { miseInstall: "bg", verbose: true }],
      ["up", "demo", { verbose: true }],
      ["down", "demo"],
    ]);
  });

  it("always detaches watch for MCP", () => {
    expect(definition("watch").mcpFixed).toEqual({ detach: true });
  });

  it("is not wired to the editor socket in the CLI or the MCP server", () => {
    const sources = [
      new URL("./commands.ts", import.meta.url),
      new URL("./index.ts", import.meta.url),
      new URL(import.meta.resolve("variant-cli/bundle")),
      new URL(import.meta.resolve("variant-mcp/bundle")),
    ]
      .map((url) => readFileSync(url, "utf8"))
      .join("\n");

    expect(sources).not.toContain("variant-ipc");
  });
});
