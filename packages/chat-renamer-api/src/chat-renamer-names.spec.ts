import { describe, expect, it } from "bun:test";

import { chatRenamerNames } from "./chat-renamer-names";

describe("chatRenamerNames", () => {
  it("defaults to the chat-renamer prefix for everything", () => {
    expect(chatRenamerNames()).toEqual({
      renameChat: "chat-renamer.renameChat",
      renameChatFromPrompt: "chat-renamer.renameChatFromPrompt",
      renameExistingChats: "chat-renamer.renameExistingChats",
      renameActiveChat: "chat-renamer.renameActiveChat",
      configSection: "chat-renamer",
      hookScriptName: "chat-renamer-chat-rename.sh",
    });
  });

  it("lets a host extension keep its own prefix and settings section", () => {
    expect(chatRenamerNames({ commandPrefix: "variant", configSection: "variant" })).toEqual({
      renameChat: "variant.renameChat",
      renameChatFromPrompt: "variant.renameChatFromPrompt",
      renameExistingChats: "variant.renameExistingChats",
      renameActiveChat: "variant.renameActiveChat",
      configSection: "variant",
      hookScriptName: "variant-chat-rename.sh",
    });
  });
});
