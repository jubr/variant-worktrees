import { describe, expect, it } from "bun:test";

import { parseChatRenameSlash } from "./chat-rename-slash";

describe("parseChatRenameSlash", () => {
  it.each([
    ['/chat-rename "two words"', "two words"],
    ["/chat-rename 'two words'", "two words"],
    ["/chat-rename single-word-no-spaces", "single-word-no-spaces"],
    ['/chat-rename "single"', "single"],
    ["/chat-rename   'padded   inner   spaces'  ", "padded inner spaces"],
    ['  /chat-rename "leading whitespace"', "leading whitespace"],
    ['/chat-rename\t"tab separated"', "tab separated"],
    ["/chat-rename “smart double”", "smart double"],
    ["/chat-rename ‘smart single’", "smart single"],
    ['/chat-rename "it\'s fine"', "it's fine"],
    ["/chat-rename 'say \"hi\"'", 'say "hi"'],
    ['/chat-rename "escaped \\"quote\\" inside"', 'escaped "quote" inside'],
    ["/chat-rename 'it\\'s escaped'", "it's escaped"],
    ["/chat-rename don't", "don't"],
    ['/rename-chat "two words"', "two words"],
    ["/rename-chat 'two words'", "two words"],
    ["/rename-chat abc-def", "abc-def"],
    ["  /rename-chat   padded  ", "padded"],
  ])("accepts %s", (input, title) => {
    expect(parseChatRenameSlash(input)).toEqual({ kind: "rename", title });
  });

  it.each([
    "hello world",
    "/chat-renamed foo",
    "/chat-rename-foo",
    "please /chat-rename foo",
    "",
    "/other-command foo",
    "/rename-chatter foo",
    "/rename-chat-foo",
    "please /rename-chat foo",
  ])("ignores %p", (input) => {
    expect(parseChatRenameSlash(input)).toEqual({ kind: "none" });
  });

  it.each([
    ["/chat-rename", "missing"],
    ["/chat-rename   ", "missing"],
    ['/chat-rename ""', "empty"],
    ["/chat-rename '   '", "empty"],
    ["/chat-rename two words unquoted", "quote"],
    ['/chat-rename "unterminated', "quote"],
    ["/chat-rename 'mismatched\"", "quote"],
    ['/chat-rename "a" "b"', "quote"],
    ["/rename-chat", "missing"],
    ["/rename-chat two words unquoted", "quote"],
  ])("reports an error for %s", (input, hint) => {
    const result = parseChatRenameSlash(input);

    expect(result.kind).toBe("error");
    expect(result.kind === "error" ? result.reason : "").toContain(hint);
  });
});
