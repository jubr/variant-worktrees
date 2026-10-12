import {
  type ChatRenamerNames,
  type ChatRenamerNamesInput,
  chatRenamerNames,
  type Logger,
  type RenameOptions,
} from "chat-renamer-api";
import type * as vscode from "vscode";

import { registerRenameChatCommands } from "./commands";
import { createExtensionLog } from "./log";
import { startChatRenameTrigger } from "./trigger";

export type RegisterChatRenamerOptions = ChatRenamerNamesInput & {
  /** Where activity is logged. Default: a "Chat Renamer" output channel. */
  log?: Logger;
  /** Home folder whose `.cursor` receives user-scope hooks. Default: the OS home folder. */
  homeDir?: string;
};

/**
 * Starts the chat renamer inside a host extension: the rename commands, the `/chat-rename` URI handler and the
 * configured trigger. The host extension's manifest must contribute the settings (`trigger`, `hookScope`,
 * `activationPatterns`) under `configSection` and list `onStartupFinished` and `onUri` as activation events.
 * Disposables are added to `context.subscriptions`. `ready` resolves when the first trigger setup pass is done.
 *
 * AIDEV-NOTE: the rename call borrows the identity of Cursor's built-in agent-host extension, so it reads and
 * briefly rewrites `context.extension.packageJSON`. Call this from `activate` of the extension that owns that context.
 */
export const registerChatRenamer = (
  context: vscode.ExtensionContext,
  { log, homeDir, ...nameInput }: RegisterChatRenamerOptions = {},
): { names: ChatRenamerNames; ready: Promise<void> } => {
  const names = chatRenamerNames(nameInput);
  const logger = log ?? createExtensionLog(context);
  const options: RenameOptions = {};
  logger.info(`chat renamer starting (commands ${names.renameChat}, settings ${names.configSection}.*)`);
  context.subscriptions.push(...registerRenameChatCommands(context, logger, options, names));
  const ready = startChatRenameTrigger(context, logger, options, names, homeDir);
  return { names, ready };
};
