import { createExtensionLog, registerChatRenamer } from "chat-renamer";
import { type LogLevel, setLogSink } from "variant-api";
import * as vscode from "vscode";
import { formatProbeReport } from "./cursor-command-probe.ts";
import { formatVariantLog } from "./format-log.ts";
import { registerExtensionMcp, unregisterExtensionMcp } from "./mcp-registration.ts";
import { miseBinPathSetting, registerOnboardingFlow } from "./onboarding.ts";
import { chatRenamerConfigFor } from "./renamer-config.ts";
import { bindSockets, stopSockets } from "./socket.ts";
import { registerVariantsView } from "./variants-view.ts";

export const LOG_CHANNEL_NAME = "Variant Worktrees";

export const activate = (context: vscode.ExtensionContext): Promise<void> => {
  const log = createExtensionLog(context, LOG_CHANNEL_NAME);
  const write: Record<LogLevel, (message: string) => void> = {
    trace: (message) => log.trace(message),
    debug: (message) => log.debug(message),
    info: (message) => log.info(message),
    warn: (message) => log.warn(message),
    error: (message) => log.error(message),
  };
  setLogSink((event) => write[event.level](formatVariantLog(event)));
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
  if (workspaceRoot !== undefined) {
    registerExtensionMcp(context, workspaceRoot);
    const view = registerVariantsView(context, { root: workspaceRoot, log, miseBinPath: miseBinPathSetting });
    registerOnboardingFlow(context, { root: workspaceRoot, view, log });
  }
  context.subscriptions.push({
    dispose: () => {
      void stopSockets();
    },
  });
  return bindSockets();
};

export const deactivate = (): Promise<void> => {
  unregisterExtensionMcp();
  return stopSockets();
};
