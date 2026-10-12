import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

type Manifest = {
  activationEvents: string[];
  contributes: { configuration: { properties: Record<string, unknown> } };
};

const read = (path: string): Manifest => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

/** Settings of the embedded chat renamer, with the standalone prefix mapped to this extension's section. */
const toVariantKeys = (properties: Record<string, unknown>): Record<string, unknown> =>
  JSON.parse(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [
          key.replace("chat-renamer.", "variant-worktrees.chatRename."),
          value,
        ]),
      ),
    ).replaceAll("chat-renamer.trigger", "variant-worktrees.chatRename.trigger"),
  );

describe("embedded chat renamer manifest", () => {
  const variant = read("../package.json");
  const renamer = read("../../chat-renamer-vscode/package.json");

  // VS Code reads contributions only from this extension's own manifest, so they are copied. This keeps the copy honest.
  it("contributes the same settings as chat-renamer-vscode under the variant-worktrees.chatRename section", () => {
    expect(variant.contributes.configuration.properties).toEqual(
      expect.objectContaining(toVariantKeys(renamer.contributes.configuration.properties)),
    );
  });

  it("has the activation events the renamer needs", () => {
    for (const event of renamer.activationEvents) {
      expect(variant.activationEvents).toContain(event);
    }
  });
});
