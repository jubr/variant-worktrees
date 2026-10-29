/**
 * Specification: openspec/specs/chat-renamer/chat-renaming/spec.md
 */
import type { CatalogSession } from "chat-renamer-api";

export type ActiveChatRule = "newest selected" | "first selected" | "newest in catalog" | "none";

export type ActiveChatChoice = {
  /** The chosen chat; undefined when the rule is `none`. */
  id?: string;
  rule: ActiveChatRule;
  /** The selected ids that counted, in the order Cursor returned them. */
  ids: string[];
  /** The catalog entries that took part in the choice. */
  chats: CatalogSession[];
};

const updated = (chat: CatalogSession): number =>
  typeof chat.updatedAt === "number" && Number.isFinite(chat.updatedAt) ? chat.updatedAt : Number.NEGATIVE_INFINITY;

const ID_FIELDS = ["composerId", "sessionId", "id"] as const;

/** A selected chat as a string, or as an object that carries its id in a known field. */
const idOf = (item: unknown): string | undefined => {
  if (typeof item === "string") {
    return item.length > 0 ? item : undefined;
  }
  if (typeof item !== "object" || item === null) {
    return undefined;
  }
  const record = item as Record<string, unknown>;
  const field = ID_FIELDS.find((name) => typeof record[name] === "string" && record[name] !== "");
  return field === undefined ? undefined : (record[field] as string);
};

/** The chat with the newest `updatedAt`; the earliest one wins a tie. */
const newestOf = (chats: readonly CatalogSession[]): CatalogSession | undefined =>
  chats.reduce<CatalogSession | undefined>(
    (best, chat) => (best === undefined || updated(chat) > updated(best) ? chat : best),
    undefined,
  );

export const chooseActiveChat = (selection: unknown, catalog: readonly CatalogSession[]): ActiveChatChoice => {
  const ids = Array.isArray(selection) ? selection.flatMap((item) => idOf(item) ?? []) : [];
  const chats = ids.flatMap((id) => catalog.find((chat) => chat.sessionId === id) ?? []);
  const newestSelected = newestOf(chats);
  if (newestSelected) {
    return { id: newestSelected.sessionId, rule: "newest selected", ids, chats };
  }
  if (ids.length > 0) {
    return { id: ids[0], rule: "first selected", ids, chats };
  }
  const newest = newestOf(catalog);
  if (newest) {
    return { id: newest.sessionId, rule: "newest in catalog", ids, chats: [newest] };
  }
  return { rule: "none", ids, chats };
};
