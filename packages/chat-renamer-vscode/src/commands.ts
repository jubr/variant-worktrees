import {
  type ChatRenamerNames,
  type Logger,
  type RenameOptions,
  renameChat,
  renameChatFromPrompt,
} from "chat-renamer-api";
import * as vscode from "vscode";

import { resolveChatRenameDeps } from "./cursor-host";
import type { ExistingChatsRunner } from "./existing-chats";

const logged =
  <Args extends unknown[], Result>(log: Logger, name: string, run: (...args: Args) => Promise<Result>) =>
  async (...args: Args): Promise<Result> => {
    try {
      const result = await run(...args);
      log.info(`${name}(${args.map((arg) => JSON.stringify(arg)).join(", ")}) -> ${JSON.stringify(result ?? null)}`);
      return result;
    } catch (error) {
      log.error(`${name}(${args.map((arg) => JSON.stringify(arg)).join(", ")}) failed`, error);
      throw error;
    }
  };

/**
 * Registers the `renameChat(id, title)`, `renameChatFromPrompt(id, prompt)` and `renameExistingChats()` commands
 * under `names`.
 */
export const registerRenameChatCommands = (
  context: vscode.ExtensionContext,
  log: Logger,
  options: RenameOptions,
  names: ChatRenamerNames,
  existing: ExistingChatsRunner,
): vscode.Disposable[] => [
  vscode.commands.registerCommand(
    names.renameChat,
    logged(log, "renameChat", (id: string, title: string) => renameChat(resolveChatRenameDeps(context), id, title)),
  ),
  vscode.commands.registerCommand(
    names.renameChatFromPrompt,
    logged(log, "renameChatFromPrompt", (id: string, prompt: string) =>
      renameChatFromPrompt(resolveChatRenameDeps(context), id, prompt, options),
    ),
  ),
  vscode.commands.registerCommand(
    names.renameExistingChats,
    logged(log, "renameExistingChats", async () => {
      const outcome = await existing.run("command", { ignoreRecord: true });
      if (outcome.kind === "off") {
        void vscode.window.showWarningMessage(
          `Renaming existing chats is off: ${outcome.setting}. Set ${existing.settingName} to a number of days above 0.`,
        );
      } else if (outcome.kind === "failed") {
        void vscode.window.showErrorMessage(`Renaming existing chats failed (${outcome.setting}): ${outcome.error}`);
      } else {
        const { examined, renamed, failed } = outcome.result;
        void vscode.window.showInformationMessage(
          `Existing chats (${outcome.setting}): examined ${examined}, renamed ${renamed.length}, failed ${failed.length}.`,
        );
      }
      return outcome.kind === "done" ? { renamed: outcome.result.renamed.length } : { kind: outcome.kind };
    }),
  ),
];
