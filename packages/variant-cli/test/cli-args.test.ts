import { describe, expect, it } from "bun:test";
import { type CommandDefinition, commands } from "variant-api/commands";
import { collectArgs } from "../src/cli-args.js";

const definition = (name: string): CommandDefinition => {
  const found = commands.find((command) => command.name === name);
  if (!found) {
    throw new Error(`no command ${name}`);
  }
  return found;
};

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

  it("passes --pull-ff to create, provision, up, and watch", () => {
    for (const name of ["create", "provision", "up", "watch"]) {
      expect(collectArgs(definition(name), { slug: "demo", pullFf: true })).toEqual({ slug: "demo", pullFf: true });
      expect(definition(name).args.find((arg) => arg.name === "pullFf")?.short).toBeUndefined();
    }
    for (const name of ["down", "implode"]) {
      expect(definition(name).args.find((arg) => arg.name === "pullFf")).toBeUndefined();
    }
  });

  it("leaves pullFf off the arguments when the flag is omitted", async () => {
    const seen: unknown[] = [];
    const client = {
      create: async (...args: unknown[]) => {
        seen.push(args);
        return {};
      },
    };
    await definition("create").execute(client as never, { slug: "demo" });
    expect(seen).toEqual([["demo", {}]]);
  });

  it("passes --from to create, provision, up, and watch", () => {
    for (const name of ["create", "provision", "up", "watch"]) {
      expect(collectArgs(definition(name), { slug: "demo", from: "feat/other" })).toEqual({
        slug: "demo",
        from: "feat/other",
      });
      expect(definition(name).args.find((arg) => arg.name === "from")?.short).toBeUndefined();
    }
  });

  it("forwards from from execute to the client", async () => {
    const seen: unknown[] = [];
    const record =
      (name: string) =>
      async (...args: unknown[]) => {
        seen.push([name, ...args]);
        return {};
      };
    const client = {
      create: record("create"),
      provision: record("provision"),
      up: record("up"),
      watch: record("watch"),
    };
    const args = { slug: "demo", from: "abc123" };
    for (const name of ["create", "provision", "up", "watch"] as const) {
      await definition(name).execute(client as never, args);
    }

    expect(seen).toEqual([
      ["create", "demo", { from: "abc123" }],
      ["provision", "demo", { from: "abc123" }],
      ["up", "demo", { from: "abc123" }],
      ["watch", "demo", { from: "abc123" }],
    ]);
  });

  it("leaves out flags that were not given", () => {
    expect(collectArgs(definition("watch"), { detach: undefined, slug: undefined })).toEqual({});
  });
});
