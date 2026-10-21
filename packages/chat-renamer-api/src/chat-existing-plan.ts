import { hasSameBase, titleBase, titleNumber } from "./chat-title-numbering";

export type ExistingChat = {
  sessionId: string;
  currentTitle?: string;
  createdAtMs: number;
  request: { title: string; viaPattern: boolean };
};

export type PlannedRename = { sessionId: string; title: string };

const byCreation = (a: ExistingChat, b: ExistingChat): number =>
  a.createdAtMs - b.createdAtMs || (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0);

/**
 * Titles for chats that already exist, so that chats asking for the same name come out numbered by age: the oldest
 * keeps the plain base, the next gets 2, then 3. Pattern titles group by their base (trailing digits removed,
 * case-insensitive); slash titles are literal and stay out of the groups. A chat whose current title already has its
 * group's base is left untouched and holds its number (none counts as 1); the other chats of the group take the
 * smallest free numbers, oldest first. Chats that already carry their planned title are left out. The result does not
 * depend on the order of `chats`.
 */
export const planExistingRenames = (chats: readonly ExistingChat[]): PlannedRename[] => {
  const ordered = [...chats].sort(byCreation);
  const groups = new Map<string, { base: string; taken: Set<number>; next: number }>();
  const untouched = new Set<string>();
  const keyOf = (chat: ExistingChat): string | undefined =>
    chat.request.viaPattern && titleBase(chat.request.title).length > 0
      ? titleBase(chat.request.title).toLowerCase()
      : undefined;

  for (const chat of ordered) {
    const key = keyOf(chat);
    if (key === undefined) {
      continue;
    }
    const group = groups.get(key) ?? { base: titleBase(chat.request.title), taken: new Set<number>(), next: 1 };
    groups.set(key, group);
    if (chat.currentTitle !== undefined && hasSameBase(chat.currentTitle, chat.request.title)) {
      untouched.add(chat.sessionId);
      group.taken.add(titleNumber(chat.currentTitle));
    }
  }

  const plan: PlannedRename[] = [];
  for (const chat of ordered) {
    if (untouched.has(chat.sessionId)) {
      continue;
    }
    let title = chat.request.title;
    const group = groups.get(keyOf(chat) ?? "");
    if (group) {
      while (group.taken.has(group.next)) {
        group.next += 1;
      }
      title = group.next === 1 ? group.base : `${group.base}${group.next}`;
      group.next += 1;
    }
    if (title !== chat.currentTitle) {
      plan.push({ sessionId: chat.sessionId, title });
    }
  }
  return plan;
};
