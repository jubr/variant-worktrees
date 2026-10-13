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
  // AIDEV-NOTE: command ids and settings use the `variant.` prefix. `variant.enable` false turns chat renaming off.
  const workspaceRoot = vscode.workspace?.workspaceFolders?.[0]?.uri.fsPath;
  registerChatRenamer(context, {
    commandPrefix: "variant",
    configSection: "variant",
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
