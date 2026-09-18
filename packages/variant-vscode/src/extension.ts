import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {
  const disposable = vscode.commands.registerCommand("variant-vscode.helloworld", () => {
    vscode.window.showInformationMessage("Hello from Variant!");
  });

  context.subscriptions.push(disposable);
};

export const deactivate = () => {};
