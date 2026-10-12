import { describe, expect, it } from "bun:test";

import { compilePatterns, DEFAULT_ACTIVATION_PATTERNS, findRenameRequest } from "./chat-rename-patterns";

const defaults = compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns;

describe("compilePatterns", () => {
  it("compiles valid sources and reports invalid ones without throwing", () => {
    const invalid: string[] = [];

    const { patterns } = compilePatterns(["^ok$", "([unclosed", "", "  "], (source) => invalid.push(source));

    expect(patterns).toHaveLength(1);
    expect(invalid).toEqual(["([unclosed"]);
  });

  it("ignores non-string entries", () => {
    expect(compilePatterns([1, null, "a"] as unknown[] as string[]).patterns).toHaveLength(1);
  });
});

describe("default activation pattern", () => {
  it.each([
    ["/vw-spec-start cursor-chat-win-rename", "cursor-chat-win-rename"],
    ["/vw-spec-iterate  my_slug2", "my_slug2"],
    ["/abc-spec-wrapup\tfeat-x", "feat-x"],
    ["Please do this.\n\n/vw-spec-start some-slug\nthanks", "some-slug"],
  ])("matches %p", (prompt, title) => {
    expect(findRenameRequest(prompt, defaults)).toEqual({ kind: "rename", title, viaPattern: true });
  });

  it.each(["vw-spec-start slug", "/vw-start slug", "/vw-spec-start", "fix the build"])("ignores %p", (prompt) => {
    expect(findRenameRequest(prompt, defaults)).toEqual({ kind: "none" });
  });
});

describe("findRenameRequest", () => {
  it("lets the slash command win over patterns and marks it as not pattern-derived", () => {
    expect(findRenameRequest('/chat-rename "My title"', defaults)).toEqual({
      kind: "rename",
      title: "My title",
      viaPattern: false,
    });
    expect(findRenameRequest("/rename-chat abc-def", defaults)).toEqual({
      kind: "rename",
      title: "abc-def",
      viaPattern: false,
    });
  });

  it("uses the first capture group that matched, or the whole match without groups", () => {
    const { patterns } = compilePatterns(["TICKET-\\d+", "branch:(\\w+)|ref:(\\w+)"]);

    expect(findRenameRequest("fix TICKET-42 now", patterns)).toEqual({
      kind: "rename",
      title: "TICKET-42",
      viaPattern: true,
    });
    expect(findRenameRequest("ref:abc", patterns)).toEqual({ kind: "rename", title: "abc", viaPattern: true });
  });

  it("reports a malformed slash command instead of falling through", () => {
    const result = findRenameRequest("/chat-rename two words", defaults);

    expect(result.kind).toBe("error");
  });

  it("returns none for empty text", () => {
    expect(findRenameRequest("", defaults)).toEqual({ kind: "none" });
  });
});
