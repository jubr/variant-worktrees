import { describe, expect, it, spyOn } from "bun:test";
import * as vscode from "vscode";

import { captureLog } from "../test/log";
import { registerChatRenamer } from "./register";

const context = () => ({ subscriptions: [] as unknown[] }) as unknown as vscode.ExtensionContext;

describe("registerChatRenamer", () => {
  it("registers the rename commands under the default chat-renamer prefix", () => {
    const registerCommand = spyOn(vscode.commands, "registerCommand");
    registerCommand.mockClear();

    const { names } = registerChatRenamer(context());

    expect(names.configSection).toBe("chat-renamer");
    expect(registerCommand.mock.calls.map((call) => call[0])).toEqual([
      "chat-renamer.renameChat",
      "chat-renamer.renameChatFromPrompt",
      "chat-renamer.renameExistingChats",
      "chat-renamer.renameActiveChat",
    ]);
  });

  it("lets a host extension keep its own command prefix and settings section", () => {
    const registerCommand = spyOn(vscode.commands, "registerCommand");
    registerCommand.mockClear();

    const { names } = registerChatRenamer(context(), {
      commandPrefix: "variant",
      configSection: "variant",
    });

    expect(names.hookScriptName).toBe("variant-chat-rename.sh");
    expect(registerCommand.mock.calls.map((call) => call[0])).toEqual([
      "variant.renameChat",
      "variant.renameChatFromPrompt",
      "variant.renameExistingChats",
      "variant.renameActiveChat",
    ]);
  });

  it("logs to the supplied logger", () => {
    const captured = captureLog();
    const { log } = captured;

    registerChatRenamer(context(), { log });

    expect(captured.lines[0]).toContain("chat-renamer.renameChat");
  });

  it("adds its disposables to the extension context", () => {
    const ctx = context();

    registerChatRenamer(ctx);

    expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(2);
  });
});
