import { createExtensionLog, registerChatRenamer } from "chat-renamer-vscode";
import { createListener, type SocketListener, socketPath } from "variant-ipc";
import * as vscode from "vscode";
import { formatProbeReport } from "./cursor-command-probe.ts";
import { chatRenamerConfigFor } from "./renamer-config.ts";

export const LOG_CHANNEL_NAME = "Variant Worktrees";

const LIFECYCLE_COMMANDS = new Set(["config", "create", "destroy", "list", "switch", "provision"]);

const listeners = new Map<string, SocketListener>();

const stopSockets = async (): Promise<void> => {
  const owned = [...listeners.values()];
  listeners.clear();
  await Promise.all(owned.map((listener) => listener.stop()));
};

/**
 * Specification: openspec/specs/variant-vscode/ipc-endpoint/spec.md
 */
const bindSockets = async (): Promise<void> => {
  const folders = vscode.workspace?.workspaceFolders ?? [];
  const paths = new Set(folders.map((folder) => socketPath(folder.uri.fsPath)));
  for (const path of paths) {
    if (listeners.has(path)) {
      continue;
    }
    const listener = createListener(path, (request) => {
      if (LIFECYCLE_COMMANDS.has(request.name)) {
        throw new Error(`${request.name} is not handled on the extension socket`);
      }
      throw new Error(`unsupported editor request: ${request.name}`);
    });
    try {
      await listener.start();
      listeners.set(path, listener);
    } catch {
      await listener.stop();
    }
  }
};

export const activate = (context: vscode.ExtensionContext): Promise<void> => {
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
  context.subscriptions.push({
    dispose: () => {
      void stopSockets();
    },
  });
  return bindSockets();
};

export const deactivate = (): Promise<void> => stopSockets();
