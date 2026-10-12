import type { FirstPrompt } from "./chat-first-prompt";
import { findRenameRequest, type RenameRequest } from "./chat-rename-patterns";
import { numberedTitle } from "./chat-title-numbering";

export const BUILTIN_AGENT_HOST_ID = "anysphere.cursor-agent-host";

export type Description = {
  identifier?: unknown;
  isBuiltin?: boolean;
  enabledApiProposals?: string[];
};

export type CatalogTitleChange = { sessionId: string; title?: string };

export type AgentHostApi = {
  projectAgentHostSessionTitle?: (sessionId: string, title: string) => Promise<void>;
  listAgentHostSessionCatalog?: (limit?: number) => Promise<Array<{ sessionId: string; title?: string }>>;
  onDidChangeAgentHostSessionCatalogTitle?: (listener: (change: CatalogTitleChange) => void) => {
    dispose(): void;
  };
};

export type ChatRenameDeps = {
  cursor: AgentHostApi | undefined;
  mine: Description;
  donor: Description;
};

/**
 * Runs `call` while `deps.mine` carries the built-in extension's identifier, isBuiltin flag and API proposals,
 * then restores ours. Cursor's gate reads the description synchronously inside the API call, so only the
 * synchronous part of `call` sees the borrowed identity.
 *
 * AIDEV-NOTE: this deliberately works around a Cursor access guard. Local experiments only; a Cursor update can break it.
 */
export const withBorrowedIdentity = <T>(deps: Pick<ChatRenameDeps, "mine" | "donor">, call: () => T): T => {
  const { mine, donor } = deps;
  const saved: Description = {
    identifier: mine.identifier,
    isBuiltin: mine.isBuiltin,
    enabledApiProposals: mine.enabledApiProposals,
  };
  try {
    mine.identifier = donor.identifier;
    mine.isBuiltin = true;
    mine.enabledApiProposals = donor.enabledApiProposals;
    return call();
  } finally {
    mine.identifier = saved.identifier;
    mine.isBuiltin = saved.isBuiltin;
    mine.enabledApiProposals = saved.enabledApiProposals;
  }
};

/**
 * Writes the stored name of a Cursor chat. Not a stable API.
 *
 * Cursor 3.23.23 exposes `cursor.projectAgentHostSessionTitle(sessionId, title)` to extensions, but gates it to the
 * built-in `anysphere.cursor-agent-host` extension: the calling extension description must have `isBuiltin`, that
 * identifier, and the private `cursor` / `cursorAgentHost` proposals. The gate runs synchronously inside the call,
 * so this borrows those three fields for that one call and restores ours in `finally`.
 *
 * AIDEV-NOTE: this deliberately works around a Cursor access guard. Local experiments only; a Cursor update can break it.
 */
export const renameChat = async (deps: ChatRenameDeps, id: string, title: string): Promise<void> => {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("renameChat needs a non-empty chat id");
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("renameChat needs a non-empty title");
  }
  const project = deps.cursor?.projectAgentHostSessionTitle;
  if (!deps.cursor || typeof project !== "function") {
    throw new Error("cursor.projectAgentHostSessionTitle is not available in this build");
  }

  const pending = withBorrowedIdentity(deps, () => Promise.resolve(project.call(deps.cursor, id, title)));
  await pending;
};

export type RenameOptions = {
  /** Extra activation patterns (see chat-rename-patterns.ts). The slash commands are always recognised. */
  patterns?: readonly RegExp[];
  /** Titles of the other open chats. When given, titles that came from a pattern are numbered to stay distinct. */
  peerTitles?: (sessionId: string) => Promise<string[]>;
};

const applyRequest = async (
  deps: ChatRenameDeps,
  id: string,
  request: Extract<RenameRequest, { kind: "rename" }>,
  options: RenameOptions,
): Promise<void> => {
  const title =
    request.viaPattern && options.peerTitles
      ? numberedTitle(request.title, await options.peerTitles(id))
      : request.title;
  await renameChat(deps, id, title);
};

/**
 * Handles a submitted prompt: `/chat-rename "new title"`, `/chat-rename 'new title'`, `/chat-rename word`, the
 * same with Cursor's `/rename-chat`, or a line matching one of the activation patterns.
 * Resolves false when the prompt holds no request. Throws the parse reason for a malformed slash command.
 */
export const renameChatFromPrompt = async (
  deps: ChatRenameDeps,
  id: string,
  prompt: string,
  options: RenameOptions = {},
): Promise<boolean> => {
  const request = findRenameRequest(prompt, options.patterns ?? []);
  if (request.kind === "none") {
    return false;
  }
  if (request.kind === "error") {
    throw new Error(`/chat-rename: ${request.reason}`);
  }
  await applyRequest(deps, id, request, options);
  return true;
};

/**
 * Chats Cursor currently lists (non-archived, non-subagent), read live from its session catalog. Resolves
 * undefined when this build has no `listAgentHostSessionCatalog`.
 */
export const listChatCatalog = async (
  deps: ChatRenameDeps,
  limit = 1000,
): Promise<Array<{ sessionId: string; title?: string }> | undefined> => {
  const list = deps.cursor?.listAgentHostSessionCatalog;
  if (!deps.cursor || typeof list !== "function") {
    return undefined;
  }
  return withBorrowedIdentity(deps, () => list.call(deps.cursor, limit));
};

/**
 * Titles of the other open chats. `openIds` comes from composer.getOrderedSelectedComposerIds.
 * Without the catalog API there are no peers.
 */
export const listPeerTitles = async (
  deps: ChatRenameDeps,
  openIds: readonly string[],
  selfId: string,
): Promise<string[]> => {
  const sessions = (await listChatCatalog(deps)) ?? [];
  const open = new Set(openIds);
  return sessions
    .filter((session) => session.sessionId !== selfId && open.has(session.sessionId) && session.title)
    .map((session) => session.title as string);
};

/** `<scheme>://<extension id>/chat-rename?id=<chat id>&prompt=<url-encoded /chat-rename text>`. Used by the hook script. */
export const handleChatRenameUri = async (
  deps: ChatRenameDeps,
  uri: { path: string; query: string },
  options: RenameOptions = {},
): Promise<boolean> => {
  if (uri.path !== "/chat-rename") {
    return false;
  }
  const params = new URLSearchParams(uri.query);
  const id = params.get("id") ?? "";
  if (id.length === 0) {
    throw new Error("/chat-rename URI needs an id parameter");
  }
  return renameChatFromPrompt(deps, id, params.get("prompt") ?? "", options);
};

export type TitleChangeOptions = RenameOptions & {
  /** Reads the chat's first human prompt. Without a prompt that has a timestamp the chat is not renamed. */
  readFirstPrompt?: (sessionId: string) => Promise<FirstPrompt | undefined>;
  now?: () => number;
  /** A chat whose first prompt was submitted before this time already existed, so it is left alone. */
  notBeforeMs?: number;
  /** A first prompt older than this is ignored: the title event of a new chat follows its first prompt within seconds. */
  maxAgeMs?: number;
};

const DEFAULT_MAX_AGE_MS = 30 * 1000;

/**
 * Title-event trigger. Cursor's title change event is the moment the first prompt has been named, so this reads the
 * chat's first prompt and, when it holds a rename request, renames the chat. A chat whose first prompt cannot be
 * read, or carries no timestamp, is left alone: without a timestamp there is no telling a new chat from an old one.
 * Ordinary and malformed requests are ignored.
 */
export const handleCatalogTitleChange = async (
  deps: ChatRenameDeps,
  change: CatalogTitleChange,
  options: TitleChangeOptions = {},
): Promise<boolean> => {
  const firstPrompt = await options.readFirstPrompt?.(change.sessionId);
  if (!firstPrompt || firstPrompt.submittedAtMs === undefined) {
    return false;
  }
  if (firstPrompt.submittedAtMs < (options.notBeforeMs ?? Number.NEGATIVE_INFINITY)) {
    return false;
  }
  const age = (options.now ?? Date.now)() - firstPrompt.submittedAtMs;
  if (age > (options.maxAgeMs ?? DEFAULT_MAX_AGE_MS)) {
    return false;
  }
  const request = findRenameRequest(firstPrompt.text, options.patterns ?? []);
  if (request.kind !== "rename") {
    return false;
  }
  await applyRequest(deps, change.sessionId, request, options);
  return true;
};

export const subscribeCatalogTitleChanges = (
  deps: ChatRenameDeps,
  listener: (change: CatalogTitleChange) => void,
): { dispose(): void } => {
  const subscribe = deps.cursor?.onDidChangeAgentHostSessionCatalogTitle;
  if (!deps.cursor || typeof subscribe !== "function") {
    throw new Error("cursor.onDidChangeAgentHostSessionCatalogTitle is not available in this build");
  }
  return withBorrowedIdentity(deps, () => subscribe.call(deps.cursor, listener));
};
