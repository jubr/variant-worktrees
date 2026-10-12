import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import * as vscode from "vscode";

import { activate } from "./extension.ts";

const registerCommand = spyOn(vscode.commands, "registerCommand");
const getCommands = spyOn(vscode.commands, "getCommands");
const executeCommand = spyOn(vscode.commands, "executeCommand");
const showInformationMessage = spyOn(vscode.window, "showInformationMessage");
const createOutputChannel = spyOn(vscode.window, "createOutputChannel");

const extensionContext: vscode.ExtensionContext = {
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

const probeCallback = () => {
  activate(extensionContext);
  const call = registerCommand.mock.calls.find((entry) => entry[0] === "variant-worktrees.probeCursorCommands");
  if (!call) {
    throw new Error("probe command was not registered");
  }
  return call[1] as () => Promise<void>;
};

const captureProbeChannel = () => {
  const lines: string[] = [];
  let channelName = "";
  let shown = false;
  createOutputChannel.mockImplementation((name: string) => {
    channelName = name;
    return {
      clear: () => {
        lines.length = 0;
      },
      appendLine: (line: string) => {
        lines.push(line);
      },
      show: () => {
        shown = true;
      },
    };
  });
  return {
    lines,
    channelName: () => channelName,
    shown: () => shown,
  };
};

describe("extension", () => {
  beforeEach(() => {
    registerCommand.mockClear();
    getCommands.mockClear();
    executeCommand.mockClear();
    showInformationMessage.mockClear();
    createOutputChannel.mockClear();
    extensionContext.subscriptions.length = 0;
  });

  describe("activation", () => {
    it("registers the rename chat commands", () => {
      activate(extensionContext);

      const ids = registerCommand.mock.calls.map((entry) => entry[0]);
      expect(ids).toContain("variant-worktrees.renameChat");
      expect(ids).toContain("variant-worktrees.renameChatFromPrompt");
    });

    it("registers the Cursor command probe", () => {
      activate(extensionContext);

      const ids = registerCommand.mock.calls.map((call) => call[0]);
      expect(ids).toContain("variant-worktrees.probeCursorCommands");
    });

    it("reports matching command ids in Cursor Command Probe", async () => {
      const channel = captureProbeChannel();
      getCommands.mockImplementation(async () => ["composer.renameChat", "agent.setLabel"]);

      await probeCallback()();

      expect(getCommands).toHaveBeenCalledWith(true);
      expect(channel.channelName()).toEqual("Cursor Command Probe");
      expect(channel.lines).toEqual(["agent.setLabel", "composer.renameChat"]);
      expect(channel.shown()).toBe(true);
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it("replaces the previous probe report", async () => {
      const channel = captureProbeChannel();
      const commandLists = [["composer.renameChat"], ["agent.updateLabel"]];
      let call = 0;
      getCommands.mockImplementation(async () => commandLists[call++] ?? []);

      const run = probeCallback();
      await run();
      await run();

      expect(channel.lines).toEqual(["agent.updateLabel"]);
    });

    it("reports the empty-result line when nothing matches", async () => {
      const channel = captureProbeChannel();
      getCommands.mockImplementation(async () => ["cursor.openChat"]);

      await probeCallback()();

      expect(channel.lines).toEqual(["No rename-like commands found in this build."]);
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it("contributes the probe title and activation event", () => {
      const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
        activationEvents: string[];
        contributes: { commands: { command: string; title: string }[] };
      };
      const command = manifest.contributes.commands.find(
        (entry) => entry.command === "variant-worktrees.probeCursorCommands",
      );

      expect(manifest.activationEvents).toContain("onCommand:variant-worktrees.probeCursorCommands");
      expect(command?.title).toEqual("Variant: Probe Cursor Chat Commands");
    });

    it("registers the Variant hello world command", () => {
      activate(extensionContext);

      expect(registerCommand).toHaveBeenCalled();
      const [command, callback] = registerCommand.mock.calls[0] as [string, () => void];

      expect(command).toEqual("variant-worktrees.helloworld");

      expect(showInformationMessage).not.toHaveBeenCalled();
      callback();
      expect(showInformationMessage).toHaveBeenCalledWith("Hello from Variant!");
    });
  });
});
