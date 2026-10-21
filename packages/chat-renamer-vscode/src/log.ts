import { createLogger, type Logger, silentLogger } from "chat-renamer-api";
import * as vscode from "vscode";

export const DEFAULT_LOG_CHANNEL_NAME = "Chat Renamer";

/** An output channel logger. Outside a real editor host (unit tests) it returns the silent logger. */
export const createExtensionLog = (
  context: vscode.ExtensionContext,
  channelName: string = DEFAULT_LOG_CHANNEL_NAME,
): Logger => {
  if (typeof vscode.env?.appName !== "string") {
    return silentLogger;
  }
  const channel = vscode.window.createOutputChannel(channelName);
  context.subscriptions.push(channel);
  return createLogger(channel);
};
