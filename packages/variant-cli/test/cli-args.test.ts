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

  it("leaves out flags that were not given", () => {
    expect(collectArgs(definition("watch"), { detach: undefined, slug: undefined })).toEqual({});
  });
});
