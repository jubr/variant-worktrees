export type ChatRenameSlash = { kind: "none" } | { kind: "rename"; title: string } | { kind: "error"; reason: string };

// `/rename-chat` is Cursor's own built-in slash command; `/chat-rename` is the same command with the words swapped.
const COMMAND = /^\/(?:chat-rename|rename-chat)(?=\s|$)([\s\S]*)$/;

const CLOSING_QUOTE: Record<string, string> = {
  '"': '"',
  "'": "'",
  "\u201c": "\u201d",
  "\u2018": "\u2019",
};

const escapeForClass = (char: string): string => char.replace(/[\\\]^-]/g, "\\$&");

/**
 * Detects a `/chat-rename` (or Cursor's own `/rename-chat`) prompt and extracts the new title.
 *
 *   /chat-rename "two words"   /chat-rename 'two words'   /chat-rename single-word
 *
 * Inside quotes a backslash escapes the quote character. Unquoted titles must be one word.
 * Text that does not start with one of the two commands is `none`, so callers can ignore ordinary prompts.
 */
export const parseChatRenameSlash = (text: string): ChatRenameSlash => {
  const match = COMMAND.exec(text.trim());
  if (!match) {
    return { kind: "none" };
  }

  const argument = (match[1] ?? "").trim();
  if (argument.length === 0) {
    return { kind: "error", reason: 'missing title: use /chat-rename "new title"' };
  }

  const opener = argument[0] ?? "";
  const closer = CLOSING_QUOTE[opener];
  if (closer === undefined) {
    if (/\s/.test(argument)) {
      return { kind: "error", reason: "unquoted title must be a single word: wrap it in quotes" };
    }
    return { kind: "rename", title: argument };
  }

  const endsWithCloser = argument.length >= 2 && argument.endsWith(closer);
  const inner = endsWithCloser ? argument.slice(1, -1) : "";
  const hasBareCloser = !new RegExp(`^(?:[^${escapeForClass(closer)}\\\\]|\\\\[\\s\\S])*$`).test(inner);
  if (!endsWithCloser || hasBareCloser || (closer === opener && argument.length === 1)) {
    return { kind: "error", reason: `unbalanced quote: close the title with ${closer}` };
  }

  const title = inner
    .replace(/\\([\s\S])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (title.length === 0) {
    return { kind: "error", reason: "empty title" };
  }
  return { kind: "rename", title };
};
