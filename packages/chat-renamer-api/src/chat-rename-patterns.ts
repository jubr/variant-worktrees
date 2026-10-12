import { parseChatRenameSlash } from "./chat-rename-slash";

/** Matches e.g. `/vw-spec-start my-slug`; the capture group is the title. Applied per prompt line. */
export const DEFAULT_ACTIVATION_PATTERNS: readonly string[] = ["/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)"];

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

/**
 * Looks for a rename request, line by line. On each line the `/chat-rename` and `/rename-chat` slash commands are
 * tried first (the title is taken literally), then the activation patterns (the first capture group that matched,
 * or the whole match, is the title). The first line with a result wins.
 */
export const findRenameRequest = (text: string, patterns: readonly RegExp[]): RenameRequest => {
  for (const line of text.split(/\r?\n/)) {
    const slash = parseChatRenameSlash(line);
    if (slash.kind === "rename") {
      return { kind: "rename", title: slash.title, viaPattern: false };
    }
    if (slash.kind === "error") {
      return slash;
    }
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      const title = match ? titleFromMatch(match) : undefined;
      if (title) {
        return { kind: "rename", title, viaPattern: true };
      }
    }
  }
  return { kind: "none" };
};
