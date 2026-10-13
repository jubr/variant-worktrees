import { dirname, join } from "node:path";
import {
  type ChatRenamerNames,
  catalogTitleOutcome,
  type FirstPrompt,
  type Logger,
  listChatCatalog,
  type RenameOptions,
  readFirstPromptWithRetry,
  readFirstPrompt as readStoredFirstPrompt,
  renameChat,
  renameChatFromPrompt,
} from "chat-renamer-api";
import * as vscode from "vscode";

import { resolveChatRenameDeps } from "./cursor-host";
import type { ExistingChatsRunner } from "./existing-chats";
import { readSettings } from "./settings";

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
 * Registers the `renameChat(id, title)`, `renameChatFromPrompt(id, prompt)`, `renameExistingChats()` and
 * `renameActiveChat()` commands under `names`.
 */
export const registerRenameChatCommands = (
  context: vscode.ExtensionContext,
  log: Logger,
  options: RenameOptions,
  names: ChatRenamerNames,
  existing: ExistingChatsRunner,
  readFirstPrompt?: (sessionId: string) => Promise<FirstPrompt | undefined>,
): vscode.Disposable[] => {
  const disabled = (): boolean => {
    if (readSettings(names.configSection).enabled) {
      return false;
    }
    void vscode.window.showWarningMessage(`Chat renaming is off: ${names.configSection}.enable=false.`);
    return true;
  };
  const readPrompt = (sessionId: string) =>
    readFirstPromptWithRetry(() => {
      if (readFirstPrompt) {
        return readFirstPrompt(sessionId);
      }
      const dbPath = join(dirname(context.globalStorageUri.fsPath), "state.vscdb");
      return readStoredFirstPrompt({ dbPath, sessionId });
    });

  return [
    vscode.commands.registerCommand(
      names.renameChat,
      logged(log, "renameChat", async (id: string, title: string) => {
        if (disabled()) {
          return false;
        }
        log.info(`rename ${id}: explicit title; title ${JSON.stringify(title)}`);
        return renameChat(resolveChatRenameDeps(context), id, title);
      }),
    ),
    vscode.commands.registerCommand(
      names.renameChatFromPrompt,
      logged(log, "renameChatFromPrompt", (id: string, prompt: string) => {
        if (disabled()) {
          return false;
        }
        return renameChatFromPrompt(resolveChatRenameDeps(context), id, prompt, options);
      }),
    ),
    vscode.commands.registerCommand(
      names.renameExistingChats,
      logged(log, "renameExistingChats", async () => {
        if (disabled()) {
          return { kind: "off" };
        }
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
    vscode.commands.registerCommand(
      names.renameActiveChat,
      logged(log, "renameActiveChat", async () => {
        if (disabled()) {
          return false;
        }
        const selected = await vscode.commands.executeCommand<unknown>("composer.getOrderedSelectedComposerIds");
        const id = Array.isArray(selected) && typeof selected[0] === "string" ? selected[0] : "";
        if (id.length === 0) {
          void vscode.window.showWarningMessage("No chat is selected.");
          return false;
        }
        const deps = resolveChatRenameDeps(context);
        const sessions = await listChatCatalog(deps);
        const title = sessions?.find((session) => session.sessionId === id)?.title;
        const outcome = await catalogTitleOutcome(
          deps,
          { sessionId: id, title },
          {
            ...options,
            readFirstPrompt: readPrompt,
            notBeforeMs: Number.NEGATIVE_INFINITY,
            maxAgeMs: Number.POSITIVE_INFINITY,
          },
        );
        if (outcome === "same-base") {
          return false;
        }
        if (outcome !== "renamed") {
          void vscode.window.showWarningMessage("This chat has no rename request.");
          return false;
        }
        return true;
      }),
    ),
  ];
};
