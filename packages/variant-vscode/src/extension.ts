import { createExtensionLog, registerChatRenamer } from "chat-renamer";
import * as vscode from "vscode";
import { formatProbeReport } from "./cursor-command-probe.ts";
import { chatRenamerConfigFor } from "./renamer-config.ts";

export const LOG_CHANNEL_NAME = "Variant Worktrees";

export const activate = (context: vscode.ExtensionContext) => {
  const log = createExtensionLog(context, LOG_CHANNEL_NAME);
  log.info(`activating variant-worktrees (${vscode.env?.appName ?? "unknown host"} ${vscode.version ?? ""})`.trim());
  const probe = vscode.commands.registerCommand("variant.probeCursorCommands", async () => {
    const ids = await vscode.commands.getCommands(true);
    const channel = vscode.window.createOutputChannel("Cursor Command Probe");
    channel.clear();
    for (const line of formatProbeReport(ids)) {
      channel.appendLine(line);
    }
    channel.show();
  });

  context.subscriptions.push(probe);
  // AIDEV-NOTE: command ids use the `variant.` prefix. Settings stay `variant-worktrees.chatRename` so existing user settings keep working.
  const workspaceRoot = vscode.workspace?.workspaceFolders?.[0]?.uri.fsPath;
  registerChatRenamer(context, {
    commandPrefix: "variant",
    configSection: "variant-worktrees.chatRename",
    // The chatRenamer section of variants.yaml over `variant.prefix` as the worktree prefix; settings the user set
    // explicitly in the editor still win.
    fileConfig: chatRenamerConfigFor(workspaceRoot),
    log,
  });
};

export const deactivate = () => {};
