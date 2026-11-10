import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createExtensionLog, registerChatRenamer } from "chat-renamer";
import { LogLevel, platformToken, renderVersion, repositoryUrl, resolveVersionFacts, setLogSink } from "variant-api";
import * as vscode from "vscode";
import cliPackage from "../../variant-cli/package.json" with { type: "json" };
import { formatProbeReport } from "./cursor/cursor-command-probe.ts";
import { formatVariantLog } from "./format-log.ts";
import { bindSockets, stopSockets } from "./ipc.ts";
import { registerExtensionMcp, unregisterExtensionMcp } from "./mcp-registration.ts";
import { miseBinPathSetting, registerOnboardingFlow } from "./onboarding.ts";
import { chatRenamerConfigFor } from "./renamer-config.ts";
import { registerVariantsView } from "./variants-view.ts";

export const LOG_CHANNEL_NAME = "Variant Worktrees";

const packageVersion = (context: vscode.ExtensionContext): string => {
  const published = (context.extension?.packageJSON as { version?: unknown } | undefined)?.version;
  if (typeof published === "string" && published !== "") {
    return published;
  }
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    version?: string;
  };
  return manifest.version ?? "0.0.0";
};

/** The terminal form of `variant --version`, without ANSI color. A stamped package version is not suffixed twice. */
const longVersion = (context: vscode.ExtensionContext): string => {
  const published = packageVersion(context);
  const facts = resolveVersionFacts(dirname(fileURLToPath(import.meta.url)), new Date());
  const suffix = facts.variant === "" ? "" : `-${facts.variant}`;
  const version = suffix !== "" && published.endsWith(suffix) ? published.slice(0, -suffix.length) : published;
  return renderVersion({
    version,
    ...(facts.variant === "" ? {} : { variant: facts.variant }),
    date: facts.date,
    platform: platformToken(process.platform, process.arch),
    color: false,
    banner: true,
    repository: repositoryUrl(cliPackage),
  }).trimEnd();
};

export const activate = (context: vscode.ExtensionContext): Promise<void> => {
  const log = createExtensionLog(context, LOG_CHANNEL_NAME);
  const write: Record<LogLevel, (message: string) => void> = {
    [LogLevel.trace]: (message) => log.trace(message),
    [LogLevel.debug]: (message) => log.debug(message),
    [LogLevel.info]: (message) => log.info(message),
    [LogLevel.warn]: (message) => log.warn(message),
    [LogLevel.error]: (message) => log.error(message),
  };
  setLogSink((event) => write[event.level](formatVariantLog(event)));
  log.info(`activating variant-worktrees (${vscode.env?.appName ?? "unknown host"} ${vscode.version ?? ""})`.trim());
  log.info(longVersion(context));
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
  return bindSockets((event) =>
    write[event.level](
      event.origin === undefined ? formatVariantLog(event) : `${formatVariantLog(event)} @${event.origin}`,
    ),
  );
};

export const deactivate = (): Promise<void> => {
  unregisterExtensionMcp();
  return stopSockets();
};
