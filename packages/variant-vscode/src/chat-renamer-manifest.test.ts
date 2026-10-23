import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

type Manifest = {
  activationEvents: string[];
  contributes: {
    configuration: { properties: Record<string, unknown> };
    commands: Array<{ command: string; title: string }>;
  };
};

const read = (path: string): Manifest => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

/** Settings of the embedded chat renamer, with the standalone prefix mapped to this extension's section. */
const toVariantKeys = (properties: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [key.replace("chat-renamer.", "variant."), value]),
      ),
    ).replaceAll("chat-renamer.trigger", "variant.trigger"),
  );

describe("embedded chat renamer manifest", () => {
  const variant = read("../package.json");
  const renamer = read("../../chat-renamer-vscode/package.json");

  // VS Code reads contributions only from this extension's own manifest, so they are copied. This keeps the copy honest.
  it("contributes the same settings as chat-renamer-vscode under the variant section", () => {
    expect(variant.contributes.configuration.properties).toEqual(
      expect.objectContaining(toVariantKeys(renamer.contributes.configuration.properties)),
    );
  });

  it("contributes variant.enable and reads settings from section variant", () => {
    const properties = variant.contributes.configuration.properties;
    const extension = readFileSync(new URL("./extension.ts", import.meta.url), "utf8");

    expect(Object.keys(properties).sort()).toEqual([
      "variant.activationPatterns",
      "variant.enable",
      "variant.hookScope",
      "variant.renameExistingDays",
      "variant.titleEventPromptLines",
      "variant.trigger",
      "variant.worktreePrefixes",
    ]);
    expect(properties["variant.enable"]).toMatchObject({ type: "boolean", default: true });
    expect(extension).toContain('configSection: "variant"');
  });

  it("contributes the renamer's commands under the variant prefix", () => {
    const expected = renamer.contributes.commands.map(({ command }) => command.replace("chat-renamer.", "variant."));

    expect(variant.contributes.commands.map(({ command }) => command)).toEqual(expect.arrayContaining(expected));
    expect(variant.contributes.commands).toContainEqual({
      command: "variant.renameExistingChats",
      title: "Variant: Rename Existing Chats",
    });
    expect(variant.contributes.commands).toContainEqual({
      command: "variant.renameActiveChat",
      title: "Variant: Rename active chat",
    });
  });

  it("has the activation events the renamer needs", () => {
    for (const event of renamer.activationEvents) {
      expect(variant.activationEvents).toContain(event);
    }
  });
});
