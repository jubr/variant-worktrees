import { describe, expect, it, spyOn } from "bun:test";
import * as vscode from "vscode";

import { activate } from "./extension.ts";

const registerCommand = spyOn(vscode.commands, "registerCommand");
const showInformationMessage = spyOn(vscode.window, "showInformationMessage");

const extensionContext: vscode.ExtensionContext = {
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

describe("extension", () => {
  describe("activation", () => {
    it("registers the Variant hello world command", () => {
      activate(extensionContext);

      expect(registerCommand).toHaveBeenCalled();
      const [command, callback] = registerCommand.mock.calls[0] as [string, () => void];

      expect(command).toEqual("variant-vscode.helloworld");

      expect(showInformationMessage).not.toHaveBeenCalled();
      callback();
      expect(showInformationMessage).toHaveBeenCalledWith("Hello from Variant!");
    });
  });
});
