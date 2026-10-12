import { type ExistingChat, planExistingRenames } from "./chat-existing-plan";
import type { FirstPrompt } from "./chat-first-prompt";
import { findRenameRequest } from "./chat-rename-patterns";
import { type ChatRenameDeps, listChatCatalog, renameChat } from "./cursor-chat-rename";

export type ExistingChatsOptions = {
  patterns?: readonly RegExp[];
  /** Epoch ms the renamer started. Chats whose first prompt came later belong to the realtime path. */
  startedAtMs: number;
  /** Reads a chat's first prompt once, without retries. */
  readFirstPrompt: (sessionId: string) => Promise<FirstPrompt | undefined>;
  /** Chats an earlier run already examined. Leave unset to examine every chat. */
  isRecorded?: (sessionId: string) => boolean;
  /** Called once with every chat examined this run. */
  record?: (sessionIds: string[]) => void | Promise<void>;
  /** Epoch ms. Chats whose first prompt came earlier are left alone and not recorded. Unset: no lower bound. */
  notBeforeMs?: number;
  limit?: number;
};

export type RenamedChat = { sessionId: string; title: string; previousTitle?: string; createdAtMs: number };

export type ExistingChatsResult = {
  listed: number;
  examined: number;
  renamed: RenamedChat[];
  failed: Array<{ sessionId: string; error: string }>;
};

const EPOCH_MS_FLOOR = 1e11; // 1973 in ms, 5138 in seconds: tells the two units apart

/** A chat cannot predate its last update, so a stale `updatedAt` rules it out without reading its prompt. */
const lastUpdatedBefore = (updatedAt: number | undefined, notBeforeMs: number): boolean =>
  typeof updatedAt === "number" && updatedAt > EPOCH_MS_FLOOR && updatedAt < notBeforeMs;

/**
 * Renames chats that existed before the renamer started. Reads each listed chat's first prompt once; chats whose
 * prompt holds a rename request are renamed according to planExistingRenames (oldest keeps the plain title, then 2,
 * 3, ...). Every chat with a readable, timestamped prompt is handed to `record` so automatic runs do not examine
 * it again. A failed rename does not stop the others.
 */
export const renameExistingChats = async (
  deps: ChatRenameDeps,
  options: ExistingChatsOptions,
): Promise<ExistingChatsResult> => {
  const sessions = await listChatCatalog(deps, options.limit);
  if (!sessions) {
    throw new Error("cursor.listAgentHostSessionCatalog is not available in this build");
  }

  const examined: string[] = [];
  const candidates: ExistingChat[] = [];
  for (const session of sessions) {
    if (options.isRecorded?.(session.sessionId)) {
      continue;
    }
    if (options.notBeforeMs !== undefined && lastUpdatedBefore(session.updatedAt, options.notBeforeMs)) {
      continue;
    }
    const prompt = await options.readFirstPrompt(session.sessionId);
    if (!prompt || prompt.submittedAtMs === undefined) {
      continue;
    }
    if (options.notBeforeMs !== undefined && prompt.submittedAtMs < options.notBeforeMs) {
      continue;
    }
    examined.push(session.sessionId);
    if (prompt.submittedAtMs >= options.startedAtMs) {
      continue;
    }
    const request = findRenameRequest(prompt.text, options.patterns ?? []);
    if (request.kind === "rename") {
      candidates.push({
        sessionId: session.sessionId,
        currentTitle: session.title,
        createdAtMs: prompt.submittedAtMs,
        request,
      });
    }
  }

  const result: ExistingChatsResult = { listed: sessions.length, examined: examined.length, renamed: [], failed: [] };
  const byId = new Map(candidates.map((chat) => [chat.sessionId, chat]));
  for (const planned of planExistingRenames(candidates)) {
    try {
      await renameChat(deps, planned.sessionId, planned.title);
      result.renamed.push({
        ...planned,
        previousTitle: byId.get(planned.sessionId)?.currentTitle,
        createdAtMs: byId.get(planned.sessionId)?.createdAtMs ?? 0,
      });
    } catch (error) {
      result.failed.push({
        sessionId: planned.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  await options.record?.(examined);
  return result;
};
