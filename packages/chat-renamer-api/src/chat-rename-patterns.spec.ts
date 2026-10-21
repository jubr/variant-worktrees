import { describe, expect, it } from "bun:test";
import * as shared from "chat-renamer-config";

import {
  activationPatternSources,
  compilePatterns,
  DEFAULT_ACTIVATION_PATTERNS,
  findRenameRequest,
  worktreeActivationPatterns,
} from "./chat-rename-patterns";

describe("shared defaults", () => {
  it("takes the activation patterns from chat-renamer-config", () => {
    expect(DEFAULT_ACTIVATION_PATTERNS).toBe(shared.DEFAULT_ACTIVATION_PATTERNS);
  });
});

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

describe("default path pattern", () => {
  it("captures the slug of the last path segment after its prefix token", () => {
    expect(findRenameRequest("/vw-spec-iterate @/Users/me/_v-outer/_v-inner", defaults)).toEqual({
      kind: "rename",
      title: "inner",
      viaPattern: true,
    });
    expect(findRenameRequest("/vw-spec-iterate @/Users/me/vw/_v-cursor-chat-win-rename/", defaults)).toEqual({
      kind: "rename",
      title: "cursor-chat-win-rename",
      viaPattern: true,
    });
  });

  it("derives the slug from a short @_work- mention", () => {
    expect(findRenameRequest("/vw-spec-start @_work-my-slug", defaults)).toEqual({
      kind: "rename",
      title: "my-slug",
      viaPattern: true,
    });
  });

  it("does not let the default path pattern bypass a configured prefix", () => {
    const patterns = compilePatterns(activationPatternSources(["_v-"], [...DEFAULT_ACTIVATION_PATTERNS])).patterns;

    expect(findRenameRequest("/vw-spec-iterate @/Users/me/vw/_work-my-slug", patterns)).toEqual({ kind: "none" });
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

describe("worktree path patterns", () => {
  const forPrefixes = (...prefixes: string[]) => compilePatterns(worktreeActivationPatterns(prefixes)).patterns;

  it("inserts no separator between a prefix and the slug", () => {
    expect(findRenameRequest("/vw-spec-start @/x/ws_slug", forPrefixes("ws_"))).toMatchObject({ title: "slug" });
    expect(findRenameRequest("/vw-spec-start @/x/_v-slug", forPrefixes("_v"))).toMatchObject({ title: "-slug" });
  });

  it("derives the slug of a dragged-in worktree with the default prefix", () => {
    expect(findRenameRequest("/vw-spec-iterate @/Users/me/vw/_v-cursor-chat-win-rename", forPrefixes("_v-"))).toEqual({
      kind: "rename",
      title: "cursor-chat-win-rename",
      viaPattern: true,
    });
  });

  it("accepts a custom prefix and a trailing slash", () => {
    expect(findRenameRequest("/vw-spec-iterate @/Users/me/vw/_work-my-slug/", forPrefixes("_work-"))).toMatchObject({
      kind: "rename",
      title: "my-slug",
    });
  });

  it("derives the slug from a short mention of that prefix", () => {
    expect(findRenameRequest("/vw-spec-start @_work-my-slug", forPrefixes("_work-"))).toMatchObject({
      kind: "rename",
      title: "my-slug",
    });
  });

  it("ignores a prefix that is not configured", () => {
    expect(findRenameRequest("/vw-spec-iterate @/Users/me/vw/_work-my-slug", forPrefixes("_v-"))).toEqual({
      kind: "none",
    });
  });

  it("uses the last path segment", () => {
    expect(findRenameRequest("/vw-spec-iterate @/Users/me/_v-outer/_v-inner", forPrefixes("_v-"))).toMatchObject({
      title: "inner",
    });
  });

  it("tries every configured prefix", () => {
    const patterns = forPrefixes("_v-", "_work-");

    expect(findRenameRequest("/vw-spec-start @/x/_work-a", patterns)).toMatchObject({ title: "a" });
    expect(findRenameRequest("/vw-spec-start @/x/_v-b", patterns)).toMatchObject({ title: "b" });
  });

  it("matches a prefix literally, whatever characters it holds", () => {
    expect(findRenameRequest("/vw-spec-start @/x/_wxk-slug", forPrefixes("_w.k-"))).toEqual({ kind: "none" });
    expect(findRenameRequest("/vw-spec-start @/x/_w.k-slug", forPrefixes("_w.k-"))).toMatchObject({ title: "slug" });
  });

  it("needs the spec command in front of the path", () => {
    expect(findRenameRequest("look at @/Users/me/vw/_v-my-slug", forPrefixes("_v-"))).toEqual({ kind: "none" });
  });

  it("is off for an empty or blank prefix list", () => {
    expect(worktreeActivationPatterns([])).toEqual([]);
    expect(worktreeActivationPatterns(["", "  "])).toEqual([]);
  });

  it("lists each prefix once", () => {
    expect(worktreeActivationPatterns(["_v-", "_v-"])).toHaveLength(2);
  });
});
