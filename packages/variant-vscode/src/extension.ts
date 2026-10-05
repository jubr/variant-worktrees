import * as vscode from "vscode";

import { formatProbeReport } from "./cursor-command-probe.ts";

export const activate = (context: vscode.ExtensionContext) => {
  const helloWorld = vscode.commands.registerCommand("variant-vscode.helloworld", () => {
    vscode.window.showInformationMessage("Hello from Variant!");
  });
  const probe = vscode.commands.registerCommand("variant-vscode.probeCursorCommands", async () => {
    const ids = await vscode.commands.getCommands(true);
    const channel = vscode.window.createOutputChannel("Cursor Command Probe");
    channel.clear();
    for (const line of formatProbeReport(ids)) {
      channel.appendLine(line);
    }
    channel.show();
  });

  context.subscriptions.push(helloWorld, probe);
};

export const deactivate = () => {};
