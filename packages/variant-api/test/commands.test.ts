import { describe, expect, it } from "bun:test";
import { commands } from "../src/commands.js";
import type { VariantClient } from "../src/types.js";

describe("command registry", () => {
  it("contains lifecycle and config commands", () => {
    expect(commands.map((command) => command.name)).toEqual([
      "config",
      "create",
      "list",
      "switch",
      "provision",
      "down",
      "implode",
    ]);
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

  it("routes create through the client", async () => {
    const client = {
      create: (slug?: string) => Promise.resolve({ slug }),
    } as unknown as VariantClient;
    const result = await commands
      .find((command) => command.name === "create")
      ?.execute(client, { slug: "test-feature" });
    expect(result).toEqual({ slug: "test-feature" });
  });
});
