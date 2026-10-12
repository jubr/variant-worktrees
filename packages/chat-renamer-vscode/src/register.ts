import {
  type ChatRenamerNames,
  type ChatRenamerNamesInput,
  chatRenamerNames,
  type Logger,
  type RenameOptions,
} from "chat-renamer-api";
import type * as vscode from "vscode";

import { registerRenameChatCommands } from "./commands";
import { createExistingChatsRunner } from "./existing-chats";
import { createExtensionLog } from "./log";
import type { HostSettings } from "./settings";
import { startChatRenameTrigger, type TriggerHost } from "./trigger";

export type RegisterChatRenamerOptions = ChatRenamerNamesInput & {
  /** Where activity is logged. Default: a "Chat Renamer" output channel. */
  log?: Logger;
  /** Home folder whose `.cursor` receives user-scope hooks. Default: the OS home folder. */
  homeDir?: string;
  /** Replaces the read of a chat's first prompt from Cursor's store. For tests. */
  readFirstPrompt?: TriggerHost["readFirstPrompt"];
  /** Clock in epoch milliseconds. For tests. */
  now?: () => number;
  /** Delay before the startup run and after the last title event, in milliseconds. Default 3000. For tests. */
  existingChatsDelayMs?: number;
  /**
   * Option values from the host, such as the `chatRenamer` section of `variants.yaml`. An editor setting the user set
   * explicitly wins over them; they win over the defaults.
   */
  fileConfig?: HostSettings;
};

/**
 * Starts the chat renamer inside a host extension: the rename commands, the `/chat-rename` URI handler and the
 * configured trigger. The host extension's manifest must contribute the settings (`trigger`, `hookScope`,
 * `activationPatterns`, `worktreePrefixes`, `renameExistingDays`) under `configSection` and list `onStartupFinished` and `onUri` as activation events.
 * Disposables are added to `context.subscriptions`. `ready` resolves when the first trigger setup pass is done.
 *
 * AIDEV-NOTE: the rename call borrows the identity of Cursor's built-in agent-host extension, so it reads and
 * briefly rewrites `context.extension.packageJSON`. Call this from `activate` of the extension that owns that context.
 */
export const registerChatRenamer = (
  context: vscode.ExtensionContext,
  {
    log,
    homeDir,
    readFirstPrompt,
    now,
    existingChatsDelayMs,
    fileConfig,
    ...nameInput
  }: RegisterChatRenamerOptions = {},
): { names: ChatRenamerNames; ready: Promise<void> } => {
  const names = chatRenamerNames(nameInput);
  const logger = log ?? createExtensionLog(context);
  const options: RenameOptions = {};
  logger.info(`chat renamer starting (commands ${names.renameChat}, settings ${names.configSection}.*)`);
  const existing = createExistingChatsRunner({
    context,
    log: logger,
    options,
    names,
    startedAtMs: (now ?? Date.now)(),
    readFirstPrompt,
    fileConfig,
  });
  context.subscriptions.push(...registerRenameChatCommands(context, logger, options, names, existing));
  const ready = startChatRenameTrigger(context, logger, options, names, {
    homeDir,
    readFirstPrompt,
    now,
    existing,
    existingChatsDelayMs,
    fileConfig,
  });
  return { names, ready };
};
