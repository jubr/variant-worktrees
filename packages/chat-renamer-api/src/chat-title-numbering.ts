const TRAILING_NUMBER = /(\d+)$/;

const baseOf = (title: string): string => title.replace(TRAILING_NUMBER, "");

const numberOf = (title: string): number => {
  const match = TRAILING_NUMBER.exec(title);
  return match?.[1] ? Number.parseInt(match[1], 10) : 1;
};

/**
 * Makes a title unique among the titles of other open chats by numbering it.
 *
 * The trailing number is removed from the candidate to get its base. Peers with the same base (case-insensitive)
 * count by their trailing number, a peer without one counting as 1. With peers the result is `{base}{max + 1}`:
 * `abc` with peers `abc` gives `abc2`; `def` with peers `def3`, `def5` gives `def6`.
 * Without peers the candidate is returned as typed.
 */
export const numberedTitle = (candidate: string, peerTitles: readonly string[]): string => {
  const base = baseOf(candidate);
  if (base.length === 0) {
    return candidate;
  }
  const key = base.toLowerCase();
  const numbers = peerTitles.filter((title) => baseOf(title).toLowerCase() === key).map(numberOf);
  return numbers.length === 0 ? candidate : `${base}${Math.max(...numbers) + 1}`;
};
