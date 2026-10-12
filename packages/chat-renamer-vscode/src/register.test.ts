import { describe, expect, it, spyOn } from "bun:test";
import * as vscode from "vscode";

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
    ]);
  });

  it("lets a host extension keep its own command prefix and settings section", () => {
    const registerCommand = spyOn(vscode.commands, "registerCommand");
    registerCommand.mockClear();

    const { names } = registerChatRenamer(context(), {
      commandPrefix: "variant-worktrees",
      configSection: "variant-worktrees.chatRename",
    });

    expect(names.hookScriptName).toBe("variant-worktrees-chat-rename.sh");
    expect(registerCommand.mock.calls.map((call) => call[0])).toEqual([
      "variant-worktrees.renameChat",
      "variant-worktrees.renameChatFromPrompt",
    ]);
  });

  it("logs to the supplied logger", () => {
    const lines: string[] = [];
    const log = { info: (m: string) => lines.push(m), warn: () => {}, error: () => {} };

    registerChatRenamer(context(), { log });

    expect(lines[0]).toContain("chat-renamer.renameChat");
  });

  it("adds its disposables to the extension context", () => {
    const ctx = context();

    registerChatRenamer(ctx);

    expect(ctx.subscriptions.length).toBeGreaterThanOrEqual(2);
  });
});
