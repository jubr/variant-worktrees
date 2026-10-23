import { DEFAULT_ACTIVATION_PATTERNS, DEFAULT_PATH_ACTIVATION_PATTERN } from "chat-renamer-config";

import { parseChatRenameSlash } from "./chat-rename-slash";

/** Matches e.g. `/vw-spec-start my-slug`; the capture group is the title. Applied per prompt line. */
export { DEFAULT_ACTIVATION_PATTERNS, DEFAULT_PATH_ACTIVATION_PATTERN };

/**
 * Sources the renamer compiles. Worktree-prefix patterns go first. A non-empty prefix list drops the default
 * path pattern so an unconfigured prefix cannot still yield a title.
 */
export const activationPatternSources = (prefixes: readonly string[], patterns: readonly string[]): string[] => {
  const prefixPatterns = worktreeActivationPatterns(prefixes);
  const rest =
    prefixPatterns.length > 0 ? patterns.filter((source) => source !== DEFAULT_PATH_ACTIVATION_PATTERN) : patterns;
  return [...prefixPatterns, ...rest];
};

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Patterns for a dragged-in worktree folder, one per prefix: `/vw-spec-iterate @/abs/path/_v-my-slug` gives
 * `my-slug`. The greedy `\S*` makes the last path segment win. Sources work in both JavaScript and Python `re`,
 * since the hook script evaluates them too. A prefix holds its own leading character and connector (`_v-`).
 */
export const worktreeActivationPatterns = (prefixes: readonly string[]): string[] =>
  [...new Set(prefixes.filter((prefix) => typeof prefix === "string" && prefix.trim().length > 0))].flatMap(
    (prefix) => {
      const escaped = escapeRegex(prefix);
      const slug = "([A-Za-z0-9_-]+)/?(?=\\s|$)";
      return [`/[a-z]+-spec-[a-z]+\\s+@\\S*/${escaped}${slug}`, `/[a-z]+-spec-[a-z]+\\s+@${escaped}${slug}`];
    },
  );

export type RenameRequest =
  | { kind: "none" }
  | { kind: "rename"; title: string; viaPattern: boolean }
  | { kind: "error"; reason: string };

/** Compiles JavaScript regex sources. Invalid or blank entries are reported through `onInvalid` and skipped. */
export const compilePatterns = (
  sources: readonly string[],
  onInvalid: (source: string, error: unknown) => void = () => {},
): { patterns: RegExp[] } => {
  const patterns: RegExp[] = [];
  for (const source of sources) {
    if (typeof source !== "string" || source.trim().length === 0) {
      continue;
    }
    try {
      patterns.push(new RegExp(source));
    } catch (error) {
      onInvalid(source, error);
    }
  }
  return { patterns };
};

const titleFromMatch = (match: RegExpExecArray): string | undefined => {
  const captured = match.slice(1).find((group) => typeof group === "string" && group.trim().length > 0);
  const title = (captured ?? match[0]).trim();
  return title.length > 0 ? title : undefined;
};

/** The first `limit` lines of `text`, joined with `\n`, and how many lines were read and left out. */
export const firstLines = (text: string, limit: number): { text: string; lines: number; dropped: number } => {
  const all = text.split(/\r?\n/);
  const kept = all.slice(0, limit);
  return { text: kept.join("\n"), lines: kept.length, dropped: all.length - kept.length };
};

/**
 * Looks for a rename request, line by line. On each line the `/chat-rename` and `/rename-chat` slash commands are
 * tried first (the title is taken literally), then the activation patterns (the first capture group that matched,
 * or the whole match, is the title). The first line with a result wins. `patternIndex` is the position of the
 * activation pattern that produced the title; a slash command has none.
 */
export const matchRenameRequest = (
  text: string,
  patterns: readonly RegExp[],
): { request: RenameRequest; patternIndex?: number } => {
  for (const line of text.split(/\r?\n/)) {
    const slash = parseChatRenameSlash(line);
    if (slash.kind === "rename") {
      return { request: { kind: "rename", title: slash.title, viaPattern: false } };
    }
    if (slash.kind === "error") {
      return { request: slash };
    }
    for (const [patternIndex, pattern] of patterns.entries()) {
      const match = pattern.exec(line);
      const title = match ? titleFromMatch(match) : undefined;
      if (title) {
        return { request: { kind: "rename", title, viaPattern: true }, patternIndex };
      }
    }
  }
  return { request: { kind: "none" } };
};

/** The rename request in `text`; see `matchRenameRequest`. */
export const findRenameRequest = (text: string, patterns: readonly RegExp[]): RenameRequest =>
  matchRenameRequest(text, patterns).request;
