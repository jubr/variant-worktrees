import { titleBase } from "./chat-title-numbering";

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
 * case-insensitive); slash titles are literal and stay out of the groups. Chats that already carry their planned
 * title are left out. The result does not depend on the order of `chats`.
 */
export const planExistingRenames = (chats: readonly ExistingChat[]): PlannedRename[] => {
  const ordered = [...chats].sort(byCreation);
  const seenPerBase = new Map<string, { base: string; count: number }>();
  const plan: PlannedRename[] = [];
  for (const chat of ordered) {
    let title = chat.request.title;
    const base = titleBase(title);
    if (chat.request.viaPattern && base.length > 0) {
      const key = base.toLowerCase();
      const group = seenPerBase.get(key) ?? { base, count: 0 };
      group.count += 1;
      seenPerBase.set(key, group);
      title = group.count === 1 ? group.base : `${group.base}${group.count}`;
    }
    if (title !== chat.currentTitle) {
      plan.push({ sessionId: chat.sessionId, title });
    }
  }
  return plan;
};
