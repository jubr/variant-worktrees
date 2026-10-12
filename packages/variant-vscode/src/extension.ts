import { createExtensionLog, registerChatRenamer } from "chat-renamer-vscode";
import * as vscode from "vscode";
import { formatProbeReport } from "./cursor-command-probe.ts";
import { chatRenamerConfigFor } from "./renamer-config.ts";

export const LOG_CHANNEL_NAME = "Variant Worktrees";

export const activate = (context: vscode.ExtensionContext) => {
  const log = createExtensionLog(context, LOG_CHANNEL_NAME);
  log.info(`activating variant-worktrees (${vscode.env?.appName ?? "unknown host"} ${vscode.version ?? ""})`.trim());
  const helloWorld = vscode.commands.registerCommand("variant-worktrees.helloworld", () => {
    vscode.window.showInformationMessage("Hello from Variant!");
  });
  const probe = vscode.commands.registerCommand("variant-worktrees.probeCursorCommands", async () => {
    const ids = await vscode.commands.getCommands(true);
    const channel = vscode.window.createOutputChannel("Cursor Command Probe");
    channel.clear();
    for (const line of formatProbeReport(ids)) {
      channel.appendLine(line);
    }
    channel.show();
  });

  context.subscriptions.push(helloWorld, probe);
  // AIDEV-NOTE: keep the pre-extraction command prefix and settings section so existing user settings keep working.
  const workspaceRoot = vscode.workspace?.workspaceFolders?.[0]?.uri.fsPath;
  registerChatRenamer(context, {
    commandPrefix: "variant-worktrees",
    configSection: "variant-worktrees.chatRename",
    // The chatRenamer section of variants.yaml over `variant.prefix` as the worktree prefix; settings the user set
    // explicitly in the editor still win.
    fileConfig: chatRenamerConfigFor(workspaceRoot),
    log,
  });
};

export const deactivate = () => {};
