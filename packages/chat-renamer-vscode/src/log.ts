import { createLogger, type Logger, silentLogger } from "chat-renamer-api";
import * as vscode from "vscode";

export const DEFAULT_LOG_CHANNEL_NAME = "Chat Renamer";

/**
 * A log output channel logger. A log channel is listed by Developer: Show Logs… and has its own log level.
 * Outside a real editor host (unit tests) it returns the silent logger.
 */
export const createExtensionLog = (
  context: vscode.ExtensionContext,
  channelName: string = DEFAULT_LOG_CHANNEL_NAME,
): Logger => {
  if (typeof vscode.env?.appName !== "string") {
    return silentLogger;
  }
  const channel = vscode.window.createOutputChannel(channelName, { log: true });
  context.subscriptions.push(channel);
  return createLogger(channel);
};
