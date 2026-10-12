import { describe, expect, it } from "bun:test";

import { chatRenamerNames } from "./chat-renamer-names";

describe("chatRenamerNames", () => {
  it("defaults to the chat-renamer prefix for everything", () => {
    expect(chatRenamerNames()).toEqual({
      renameChat: "chat-renamer.renameChat",
      renameChatFromPrompt: "chat-renamer.renameChatFromPrompt",
      configSection: "chat-renamer",
      hookScriptName: "chat-renamer-chat-rename.sh",
    });
  });

  it("lets a host extension keep its own prefix and settings section", () => {
    expect(
      chatRenamerNames({ commandPrefix: "variant-worktrees", configSection: "variant-worktrees.chatRename" }),
    ).toEqual({
      renameChat: "variant-worktrees.renameChat",
      renameChatFromPrompt: "variant-worktrees.renameChatFromPrompt",
      configSection: "variant-worktrees.chatRename",
      hookScriptName: "variant-worktrees-chat-rename.sh",
    });
  });
});
