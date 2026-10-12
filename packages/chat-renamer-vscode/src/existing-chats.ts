import { dirname, join } from "node:path";
import {
  type ChatRenamerNames,
  type ExistingChatsResult,
  type FirstPrompt,
  type Logger,
  type RenameOptions,
  readFirstPrompt,
  readTriggerSettings,
  renameExistingChats,
} from "chat-renamer-api";
import * as vscode from "vscode";

import { resolveChatRenameDeps } from "./cursor-host";

/** Marks every log line of this feature so it can be told apart from the realtime trigger. */
export const EXISTING_CHATS_TAG = "[existing-chats]";

const DAY_MS = 86_400_000;

export type ExistingChatsTrigger = "startup" | "title events settled" | "setting changed" | "command";

export type ExistingChatsOutcome =
  /** `renameExistingDays` is 0. `setting` reads like `<section>.renameExistingDays=0`. */
  | { kind: "off"; setting: string }
  | { kind: "done"; setting: string; result: ExistingChatsResult }
  | { kind: "failed"; setting: string; error: string };

export type ExistingChatsRunner = {
  /** The setting this feature obeys, as `<section>.renameExistingDays` (no value). */
  settingName: string;
  /** Reads `renameExistingDays` now. */
  days(): number;
  run(trigger: ExistingChatsTrigger, options?: { ignoreRecord?: boolean }): Promise<ExistingChatsOutcome>;
};

export type ExistingChatsRunnerInput = {
  context: vscode.ExtensionContext;
  log: Logger;
  options: RenameOptions;
  names: ChatRenamerNames;
  /** Epoch ms the renamer started. The window ends here and the realtime trigger owns everything later. */
  startedAtMs: number;
  /** Reads a chat's first prompt once. Default: Cursor's on-disk store. */
  readFirstPrompt?: (sessionId: string) => Promise<FirstPrompt | undefined>;
};

/**
 * Renames chats that existed before the editor started, within `renameExistingDays` days. Chats examined by an
 * automatic run are remembered in `context.globalState`, so a title the user later changes by hand stays.
 * Runs never overlap: a run waits for the previous one.
 */
export const createExistingChatsRunner = ({
  context,
  log,
  options,
  names,
  startedAtMs,
  readFirstPrompt: readPrompt,
}: ExistingChatsRunnerInput): ExistingChatsRunner => {
  const settingName = `${names.configSection}.renameExistingDays`;
  const recordKey = `${names.configSection}.examinedChats`;
  const dbPath = (): string => join(dirname(context.globalStorageUri.fsPath), "state.vscdb");
  const days = (): number =>
    readTriggerSettings((key) => vscode.workspace.getConfiguration(names.configSection).get(key)).renameExistingDays;
  const stamp = (epochMs: number): string => new Date(epochMs).toISOString();
  let queue: Promise<unknown> = Promise.resolve();

  const execute = async (trigger: ExistingChatsTrigger, ignoreRecord: boolean): Promise<ExistingChatsOutcome> => {
    const windowDays = days();
    const setting = `${settingName}=${windowDays}`;
    if (windowDays === 0) {
      log.info(`${EXISTING_CHATS_TAG} off, nothing to do for ${trigger}: ${setting}`);
      return { kind: "off", setting };
    }

    const notBeforeMs = startedAtMs - windowDays * DAY_MS;
    log.info(
      `${EXISTING_CHATS_TAG} run started by ${trigger}, obeying ${setting}: chats created ${stamp(notBeforeMs)} to ${stamp(startedAtMs)}, ` +
        `record ${ignoreRecord ? "ignored" : "honoured"}`,
    );
    try {
      const recorded = new Set(context.globalState.get<string[]>(recordKey, []));
      const result = await renameExistingChats(resolveChatRenameDeps(context), {
        patterns: options.patterns,
        startedAtMs,
        notBeforeMs,
        readFirstPrompt: readPrompt ?? ((sessionId) => readFirstPrompt({ dbPath: dbPath(), sessionId })),
        isRecorded: ignoreRecord ? undefined : (sessionId) => recorded.has(sessionId),
        record: async (sessionIds) => {
          for (const sessionId of sessionIds) {
            recorded.add(sessionId);
          }
          await context.globalState.update(recordKey, [...recorded]);
        },
      });
      for (const chat of result.renamed) {
        log.info(
          `${EXISTING_CHATS_TAG} renamed ${chat.sessionId}: ${JSON.stringify(chat.previousTitle ?? null)} -> ${JSON.stringify(chat.title)} ` +
            `(created ${stamp(chat.createdAtMs)})`,
        );
      }
      for (const failure of result.failed) {
        log.warn(`${EXISTING_CHATS_TAG} could not rename ${failure.sessionId}: ${failure.error}`);
      }
      log.info(
        `${EXISTING_CHATS_TAG} run finished (${trigger}, ${setting}): listed ${result.listed}, examined ${result.examined}, ` +
          `renamed ${result.renamed.length}, failed ${result.failed.length}`,
      );
      return { kind: "done", setting, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`${EXISTING_CHATS_TAG} run failed (${trigger}, ${setting})`, error);
      return { kind: "failed", setting, error: message };
    }
  };

  return {
    settingName,
    days,
    run: (trigger, { ignoreRecord = false } = {}) => {
      const next = queue.then(() => execute(trigger, ignoreRecord));
      queue = next;
      return next;
    },
  };
};
