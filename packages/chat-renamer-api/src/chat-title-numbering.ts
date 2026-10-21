const TRAILING_NUMBER = /(\d+)$/;

/** The title without its trailing digits. */
export const titleBase = (title: string): string => title.replace(TRAILING_NUMBER, "");

const baseOf = titleBase;

/** The trailing number of a title; a title without one counts as 1. */
export const titleNumber = (title: string): number => {
  const match = TRAILING_NUMBER.exec(title);
  return match?.[1] ? Number.parseInt(match[1], 10) : 1;
};

/**
 * Makes a title unique among the titles of other open chats by numbering it.
 *
 * A candidate that already ends in digits is returned as typed and peers are not consulted: `abc7` beside `abc`
 * stays `abc7`. A candidate that is only digits is returned as typed. Otherwise the trailing number is removed
 * to get the base. Peers with the same base (case-insensitive) count by their trailing number, a peer without
 * one counting as 1. With peers the result is `{base}{max + 1}`: `abc` with peers `abc` gives `abc2`; `def`
 * with peers `def3`, `def5` gives `def6`. Without peers the candidate is returned as typed.
 */
export const numberedTitle = (candidate: string, peerTitles: readonly string[]): string => {
  const base = baseOf(candidate);
  if (base.length === 0 || base.length < candidate.length) {
    return candidate;
  }
  const key = base.toLowerCase();
  const numbers = peerTitles.filter((title) => baseOf(title).toLowerCase() === key).map(titleNumber);
  return numbers.length === 0 ? candidate : `${base}${Math.max(...numbers) + 1}`;
};

/** Whether two titles share a non-empty base (trailing digits removed), compared case-insensitively. */
export const hasSameBase = (a: string, b: string): boolean => {
  const base = baseOf(a).toLowerCase();
  return base.length > 0 && base === baseOf(b).toLowerCase();
};
