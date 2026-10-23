import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"));

describe("extension manifest", () => {
  it("contributes the settings the trigger reads", () => {
    expect(Object.keys(manifest.contributes.configuration.properties).sort()).toEqual([
      "chat-renamer.activationPatterns",
      "chat-renamer.hookScope",
      "chat-renamer.renameExistingDays",
      "chat-renamer.titleEventPromptLines",
      "chat-renamer.trigger",
      "chat-renamer.worktreePrefixes",
    ]);
  });

  it("activates on startup and on its URI", () => {
    expect(manifest.activationEvents).toEqual(["onStartupFinished", "onUri"]);
  });

  it("keeps the default activation pattern in step with the api package", async () => {
    const { DEFAULT_ACTIVATION_PATTERNS } = await import("chat-renamer-api");

    expect(manifest.contributes.configuration.properties["chat-renamer.activationPatterns"].default).toEqual([
      ...DEFAULT_ACTIVATION_PATTERNS,
    ]);
  });

  it("keeps the other defaults in step with the shared defaults", async () => {
    const { DEFAULT_RENAME_EXISTING_DAYS, DEFAULT_TITLE_EVENT_PROMPT_LINES, DEFAULT_WORKTREE_PREFIXES } = await import(
      "chat-renamer-api"
    );
    const properties = manifest.contributes.configuration.properties;

    expect(properties["chat-renamer.worktreePrefixes"].default).toEqual([...DEFAULT_WORKTREE_PREFIXES]);
    expect(properties["chat-renamer.renameExistingDays"]).toMatchObject({
      type: "integer",
      minimum: 0,
      default: DEFAULT_RENAME_EXISTING_DAYS,
    });
    expect(properties["chat-renamer.titleEventPromptLines"]).toMatchObject({
      type: "integer",
      minimum: 1,
      default: DEFAULT_TITLE_EVENT_PROMPT_LINES,
    });
  });

  it("explains in the setting that 0 turns renaming of existing chats off", () => {
    const { markdownDescription } = manifest.contributes.configuration.properties["chat-renamer.renameExistingDays"];

    expect(markdownDescription).toContain("0");
    expect(markdownDescription).toContain("off");
  });

  it("explains that the limit applies to the title event and where the prompt shows in the log", () => {
    const { markdownDescription } = manifest.contributes.configuration.properties["chat-renamer.titleEventPromptLines"];

    expect(markdownDescription).toContain("title event");
    expect(markdownDescription).toContain("Trace");
  });

  it("contributes the command that renames existing chats", () => {
    expect(manifest.contributes.commands).toEqual([
      { command: "chat-renamer.renameExistingChats", title: "Chat Renamer: Rename Existing Chats" },
      { command: "chat-renamer.renameActiveChat", title: "Chat Renamer: Rename active chat" },
    ]);
  });

  it("ships the files a Marketplace package needs", () => {
    for (const file of ["LICENSE.txt", "README.md", ".vscodeignore"]) {
      expect(existsSync(join(import.meta.dir, "..", file))).toBe(true);
    }
  });
});
