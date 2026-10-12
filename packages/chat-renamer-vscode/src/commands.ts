import {
  type ChatRenamerNames,
  type Logger,
  type RenameOptions,
  renameChat,
  renameChatFromPrompt,
} from "chat-renamer-api";
import * as vscode from "vscode";

import { resolveChatRenameDeps } from "./cursor-host";

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

/** Registers the `renameChat(id, title)` and `renameChatFromPrompt(id, prompt)` commands under `names`. */
export const registerRenameChatCommands = (
  context: vscode.ExtensionContext,
  log: Logger,
  options: RenameOptions,
  names: ChatRenamerNames,
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
];
