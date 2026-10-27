import { describe, expect, it } from "bun:test";

import { compilePatterns, DEFAULT_ACTIVATION_PATTERNS, firstLines } from "./chat-rename-patterns";
import {
  type ChatRenameDeps,
  catalogTitleDecision,
  type Description,
  handleCatalogTitleChange,
  handleChatRenameUri,
  listPeerTitles,
  renameChat,
  renameChatFromPrompt,
  subscribeCatalogTitleChanges,
} from "./cursor-chat-rename";
import { createLogger, type Logger } from "./log";

type Entry = { level: string; message: string };

const captureLog = (): { log: Logger; entries: Entry[] } => {
  const entries: Entry[] = [];
  const at = (level: string) => (message: string) => {
    entries.push({ level, message });
  };
  return {
    entries,
    log: createLogger({
      trace: at("trace"),
      debug: at("debug"),
      info: at("info"),
      warn: at("warn"),
      error: at("error"),
    }),
  };
};

const makeDeps = (
  project: (id: string, title: string, seen: Description) => Promise<void> = async () => {},
): { deps: ChatRenameDeps; mine: Description; calls: Array<{ id: string; title: string; seen: Description }> } => {
  const donorIdentifier = { value: "anysphere.cursor-agent-host" };
  const mine: Description = {
    identifier: { value: "variant.variant-vscode" },
    isBuiltin: false,
    enabledApiProposals: [],
  };
  const donor: Description = {
    identifier: donorIdentifier,
    isBuiltin: true,
    enabledApiProposals: ["cursor", "cursorAgentHost"],
  };
  const calls: Array<{ id: string; title: string; seen: Description }> = [];
  const deps: ChatRenameDeps = {
    mine,
    donor,
    cursor: {
      projectAgentHostSessionTitle: (id, title) => {
        const seen = { ...mine };
        calls.push({ id, title, seen });
        return project(id, title, seen);
      },
    },
  };
  return { deps, mine, calls };
};

describe("renameChat", () => {
  it("calls projectAgentHostSessionTitle with the borrowed built-in identity", async () => {
    const { deps, calls } = makeDeps();

    await renameChat(deps, "chat-1", "New title");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe("chat-1");
    expect(calls[0]?.title).toBe("New title");
    expect(calls[0]?.seen.isBuiltin).toBe(true);
    expect(calls[0]?.seen.identifier).toBe(deps.donor.identifier);
    expect(calls[0]?.seen.enabledApiProposals).toEqual(["cursor", "cursorAgentHost"]);
  });

  it("restores the extension description after the call", async () => {
    const { deps, mine } = makeDeps();
    const before = { ...mine };

    await renameChat(deps, "chat-1", "New title");

    expect(mine).toEqual(before);
  });

  it("restores the extension description when the API throws synchronously", async () => {
    const { deps, mine } = makeDeps();
    const before = { ...mine };
    deps.cursor = {
      projectAgentHostSessionTitle: () => {
        throw new Error("gate closed");
      },
    };

    await expect(renameChat(deps, "chat-1", "New title")).rejects.toThrow("gate closed");
    expect(mine).toEqual(before);
  });

  it("rejects an empty id or an empty title without calling the API", async () => {
    const { deps, calls } = makeDeps();

    await expect(renameChat(deps, "", "title")).rejects.toThrow("chat id");
    await expect(renameChat(deps, "chat-1", "   ")).rejects.toThrow("title");
    expect(calls).toHaveLength(0);
  });

  it("reports a clear error when the Cursor API is not available", async () => {
    const { deps } = makeDeps();
    deps.cursor = undefined;

    await expect(renameChat(deps, "chat-1", "title")).rejects.toThrow("projectAgentHostSessionTitle");
  });
});

describe("renameChatFromPrompt", () => {
  it.each([
    ['/chat-rename "two words"', "two words"],
    ["/chat-rename 'two words'", "two words"],
    ["/chat-rename single-word-no-spaces", "single-word-no-spaces"],
  ])("renames the chat for %s", async (prompt, title) => {
    const { deps, calls } = makeDeps();

    await expect(renameChatFromPrompt(deps, "chat-1", prompt)).resolves.toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.id).toBe("chat-1");
    expect(calls[0]?.title).toBe(title);
  });

  it("returns false and does nothing for an ordinary prompt", async () => {
    const { deps, calls } = makeDeps();

    await expect(renameChatFromPrompt(deps, "chat-1", "fix the build")).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("throws the parse reason for a malformed /chat-rename", async () => {
    const { deps, calls } = makeDeps();

    await expect(renameChatFromPrompt(deps, "chat-1", "/chat-rename two words")).rejects.toThrow("quote");
    expect(calls).toHaveLength(0);
  });
});

describe("handleChatRenameUri", () => {
  const uri = (query: string, path = "/chat-rename") => ({ path, query });

  it("renames the chat named in the id parameter from the prompt parameter", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleChatRenameUri(deps, uri("id=abc-1&prompt=%2Fchat-rename+%22two+words%22"));

    expect(handled).toBe(true);
    expect(calls[0]?.id).toBe("abc-1");
    expect(calls[0]?.title).toBe("two words");
  });

  it("ignores other paths", async () => {
    const { deps, calls } = makeDeps();

    await expect(handleChatRenameUri(deps, uri("id=a&prompt=x", "/other"))).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("rejects a missing id", async () => {
    const { deps } = makeDeps();

    await expect(handleChatRenameUri(deps, uri("prompt=%2Fchat-rename+x"))).rejects.toThrow("id");
  });
});

describe("handleCatalogTitleChange", () => {
  it("does not read a request out of the title text", async () => {
    const { deps, calls } = makeDeps();

    await expect(
      handleCatalogTitleChange(deps, { sessionId: "chat-1", title: '/chat-rename "wanted name"' }),
    ).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("handleCatalogTitleChange with the first prompt", () => {
  const NOW = Date.parse("2026-10-09T15:00:00.000Z");
  const options = (prompt: { text: string; submittedAtMs?: number } | undefined) => ({
    readFirstPrompt: async () => prompt,
    now: () => NOW,
  });

  it("renames from the first prompt even when the AI title is unrelated", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Chat rename request" },
      options({ text: "/chat-rename abc-def", submittedAtMs: NOW - 4000 }),
    );

    expect(handled).toBe(true);
    expect(calls[0]?.title).toBe("abc-def");
  });

  it("finds the request on any line of a multi-line first prompt", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Two things" },
      options({ text: "Two.\n\n/chat-rename single-word-no-spaces\nthen fix it", submittedAtMs: NOW - 1000 }),
    );

    expect(handled).toBe(true);
    expect(calls[0]?.title).toBe("single-word-no-spaces");
  });

  it("ignores a first prompt submitted long ago, so old chats are not renamed again", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Some manual rename" },
      options({ text: "/chat-rename abc-def", submittedAtMs: NOW - 60 * 60 * 1000 }),
    );

    expect(handled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("does not rename when the first prompt is an ordinary prompt", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: '/chat-rename "from the title"' },
      options({ text: "fix the build", submittedAtMs: NOW - 1000 }),
    );

    expect(handled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("leaves the chat alone when the first prompt cannot be read", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: '/chat-rename "from the title"' },
      options(undefined),
    );

    expect(handled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("leaves the chat alone when the first prompt has no timestamp", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Anything" },
      options({ text: "/chat-rename abc-def" }),
    );

    expect(handled).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("handleCatalogTitleChange when the chat already has the requested base", () => {
  const NOW = Date.parse("2026-10-09T15:00:00.000Z");
  const run = (title: string, text: string) => {
    const { deps, calls } = makeDeps();
    const handled = handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title },
      {
        readFirstPrompt: async () => ({ text, submittedAtMs: NOW - 1000 }),
        patterns: compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns,
        now: () => NOW,
      },
    );
    return { handled, calls };
  };

  it("leaves a chat alone whose title has the base of a pattern title", async () => {
    const { handled, calls } = run("abc4", "/vw-spec-start abc");

    expect(await handled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("does not rename a chat already titled with a typed trailing number", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "abc7" },
      {
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc7", submittedAtMs: NOW - 1000 }),
        patterns: compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns,
        now: () => NOW,
        peerTitles: async () => ["abc"],
      },
    );

    expect(handled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("renames another title to the typed trailing number", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "New Chat" },
      {
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc7", submittedAtMs: NOW - 1000 }),
        patterns: compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns,
        now: () => NOW,
        peerTitles: async () => ["abc"],
      },
    );

    expect(handled).toBe(true);
    expect(calls[0]?.title).toBe("abc7");
  });

  it("does not rename a chat already titled with a unique pattern title", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "abc" },
      {
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc", submittedAtMs: NOW - 1000 }),
        patterns: compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns,
        now: () => NOW,
        peerTitles: async () => ["abcd", "other"],
      },
    );

    expect(handled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("renames another title to a unique pattern title", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "New Chat" },
      {
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc", submittedAtMs: NOW - 1000 }),
        patterns: compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns,
        now: () => NOW,
        peerTitles: async () => ["abcd", "other"],
      },
    );

    expect(handled).toBe(true);
    expect(calls[0]?.title).toBe("abc");
  });

  it("renames a chat whose title has another base", async () => {
    const { handled, calls } = run("Fix the login", "/vw-spec-start abc");

    expect(await handled).toBe(true);
    expect(calls[0]?.title).toBe("abc");
  });

  it("does not skip a slash title", async () => {
    const { handled, calls } = run("abc4", "/chat-rename abc");

    expect(await handled).toBe(true);
    expect(calls[0]?.title).toBe("abc");
  });
});

describe("handleCatalogTitleChange only for chats created after the renamer started", () => {
  const NOW = Date.parse("2026-10-09T15:00:00.000Z");
  const STARTED = NOW - 10_000;
  const run = (submittedAtMs: number) => {
    const { deps, calls } = makeDeps();
    const handled = handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Anything" },
      {
        readFirstPrompt: async () => ({ text: "/chat-rename abc-def", submittedAtMs }),
        now: () => NOW,
        notBeforeMs: STARTED,
      },
    );
    return { handled, calls };
  };

  it("ignores a chat whose first prompt predates the start", async () => {
    const { handled, calls } = run(STARTED - 5_000);

    await expect(handled).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("renames a chat whose first prompt came after the start", async () => {
    const { handled, calls } = run(STARTED + 5_000);

    await expect(handled).resolves.toBe(true);
    expect(calls[0]?.title).toBe("abc-def");
  });
});

describe("handleCatalogTitleChange default window", () => {
  const NOW = Date.parse("2026-10-09T15:00:00.000Z");
  const run = (ageMs: number) => {
    const { deps, calls } = makeDeps();
    const handled = handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Anything" },
      { readFirstPrompt: async () => ({ text: "/chat-rename abc-def", submittedAtMs: NOW - ageMs }), now: () => NOW },
    );
    return { handled, calls };
  };

  it("renames a chat named within 30 seconds of its first prompt", async () => {
    const { handled, calls } = run(25_000);

    await expect(handled).resolves.toBe(true);
    expect(calls[0]?.title).toBe("abc-def");
  });

  it("ignores a chat named later than 30 seconds after its first prompt", async () => {
    const { handled, calls } = run(40_000);

    await expect(handled).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("subscribeCatalogTitleChanges", () => {
  it("subscribes with the borrowed identity and restores it", () => {
    const { deps, mine } = makeDeps();
    const before = { ...mine };
    let seen: Description | undefined;
    let disposed = false;
    deps.cursor = {
      onDidChangeAgentHostSessionCatalogTitle: () => {
        seen = { ...mine };
        return {
          dispose: () => {
            disposed = true;
          },
        };
      },
    };

    const subscription = subscribeCatalogTitleChanges(deps, () => {});

    expect(seen?.isBuiltin).toBe(true);
    expect(mine).toEqual(before);
    subscription.dispose();
    expect(disposed).toBe(true);
  });

  it("throws a clear error when the event is not available", () => {
    const { deps } = makeDeps();

    expect(() => subscribeCatalogTitleChanges(deps, () => {})).toThrow("onDidChangeAgentHostSessionCatalogTitle");
  });
});

describe("activation patterns with numbering", () => {
  const patterns = compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns;
  const peers = (...titles: string[]) => ({ patterns, peerTitles: async () => titles });

  it("numbers a pattern-derived title against other open chats", async () => {
    const { deps, calls } = makeDeps();

    await expect(renameChatFromPrompt(deps, "chat-1", "/vw-spec-start abc", peers("abc"))).resolves.toBe(true);
    expect(calls[0]?.title).toBe("abc2");
  });

  it("continues from the highest number", async () => {
    const { deps, calls } = makeDeps();

    await renameChatFromPrompt(deps, "chat-1", "/vw-spec-start def", peers("def3", "def5"));

    expect(calls[0]?.title).toBe("def6");
  });

  it("keeps the title as typed when no other chat shares the base", async () => {
    const { deps, calls } = makeDeps();

    await renameChatFromPrompt(deps, "chat-1", "/vw-spec-start abc", peers("other"));

    expect(calls[0]?.title).toBe("abc");
  });

  it("does not number a literal /chat-rename title", async () => {
    const { deps, calls } = makeDeps();

    await renameChatFromPrompt(deps, "chat-1", "/chat-rename abc", peers("abc"));

    expect(calls[0]?.title).toBe("abc");
  });

  it("applies to the first prompt in the title-event trigger", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Anything" },
      {
        readFirstPrompt: async () => ({ text: "/vw-spec-iterate abc", submittedAtMs: 1_000 }),
        now: () => 2_000,
        ...peers("abc", "abc2"),
      },
    );

    expect(handled).toBe(true);
    expect(calls[0]?.title).toBe("abc3");
  });

  it("applies to the URI handler", async () => {
    const { deps, calls } = makeDeps();

    await handleChatRenameUri(
      deps,
      { path: "/chat-rename", query: "id=chat-1&prompt=%2Fvw-spec-start+abc" },
      peers("abc"),
    );

    expect(calls[0]?.title).toBe("abc2");
  });

  it("ignores a prompt that matches nothing", async () => {
    const { deps, calls } = makeDeps();

    await expect(renameChatFromPrompt(deps, "chat-1", "fix the build", peers("abc"))).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  const linesOf = () => {
    const lines: string[] = [];
    const log = { info: (message: string) => lines.push(message), warn: () => {}, error: () => {} };
    return { lines, log };
  };

  it("logs a numbered pattern title with the reason and the final title", async () => {
    const { deps } = makeDeps();
    const { lines, log } = linesOf();

    await renameChatFromPrompt(deps, "chat-1", "/vw-spec-start abc", { ...peers("abc"), log });

    expect(lines).toEqual(['rename chat-1: numbered against open chats; title "abc2"']);
  });

  it("logs a typed trailing number that is kept", async () => {
    const { deps } = makeDeps();
    const { lines, log } = linesOf();

    await renameChatFromPrompt(deps, "chat-1", "/vw-spec-start abc7", { ...peers("abc"), log });

    expect(lines).toEqual(['rename chat-1: typed trailing number kept; title "abc7"']);
  });

  it("logs a pattern title that shares no base", async () => {
    const { deps } = makeDeps();
    const { lines, log } = linesOf();

    await renameChatFromPrompt(deps, "chat-1", "/vw-spec-start abc", { ...peers("abcd", "other"), log });

    expect(lines).toEqual(['rename chat-1: no shared base; title "abc"']);
  });

  it("logs a slash command title literally", async () => {
    const { deps } = makeDeps();
    const { lines, log } = linesOf();

    await renameChatFromPrompt(deps, "chat-1", "/chat-rename abc", { ...peers("abc"), log });

    expect(lines).toEqual(['rename chat-1: slash command; title "abc"']);
  });

  it("logs a same-base skip and does not rename", async () => {
    const { deps, calls } = makeDeps();
    const { lines, log } = linesOf();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "abc7" },
      {
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc7", submittedAtMs: 1_000 }),
        now: () => 2_000,
        ...peers("abc"),
        log,
      },
    );

    expect(handled).toBe(false);
    expect(calls).toHaveLength(0);
    expect(lines).toEqual(['rename chat-1: current title shares the base; title "abc7"']);
  });
});

describe("listPeerTitles", () => {
  const withCatalog = (sessions: Array<{ sessionId: string; title?: string }>) => {
    const { deps, mine } = makeDeps();
    const before = { ...mine };
    let seen: Description | undefined;
    deps.cursor = {
      listAgentHostSessionCatalog: async () => {
        seen = { ...mine };
        return sessions;
      },
    };
    return { deps, mine, before, seen: () => seen };
  };

  it("returns titles of other open chats only", async () => {
    const { deps } = withCatalog([
      { sessionId: "a", title: "abc" },
      { sessionId: "self", title: "mine" },
      { sessionId: "closed", title: "old" },
      { sessionId: "b" },
      { sessionId: "c", title: "def3" },
    ]);

    await expect(listPeerTitles(deps, ["a", "self", "b", "c"], "self")).resolves.toEqual(["abc", "def3"]);
  });

  it("calls the catalog with the borrowed identity and restores it", async () => {
    const { deps, mine, before, seen } = withCatalog([]);

    await listPeerTitles(deps, ["a"], "self");

    expect(seen()?.isBuiltin).toBe(true);
    expect(mine).toEqual(before);
  });

  it("returns no peers when the catalog API is not available", async () => {
    const { deps } = makeDeps();
    deps.cursor = {};

    await expect(listPeerTitles(deps, ["a"], "self")).resolves.toEqual([]);
  });
});

describe("firstLines", () => {
  it("keeps the first lines and counts the dropped ones", () => {
    expect(firstLines("a\nb\nc\nd", 2)).toEqual({ text: "a\nb", lines: 2, dropped: 2 });
  });

  it("counts \\r\\n like \\n and keeps a short text whole", () => {
    expect(firstLines("a\r\nb\r\nc", 2)).toEqual({ text: "a\nb", lines: 2, dropped: 1 });
    expect(firstLines("a\nb", 10)).toEqual({ text: "a\nb", lines: 2, dropped: 0 });
  });
});

describe("handleCatalogTitleChange reads a limited number of prompt lines", () => {
  const NOW = Date.parse("2026-10-09T15:00:00.000Z");
  const patterns = compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns;
  /** A prompt of `total` lines whose line `requestLine` (1-based) is `/vw-spec-start abc`. */
  const prompt = (total: number, requestLine: number, eol = "\n"): string =>
    Array.from({ length: total }, (_, index) =>
      index + 1 === requestLine ? "/vw-spec-start abc" : `filler ${index + 1}`,
    ).join(eol);
  const run = (text: string, maxLines: number | undefined) => {
    const { deps, calls } = makeDeps();
    const { log, entries } = captureLog();
    const handled = handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: "Anything" },
      {
        readFirstPrompt: async () => ({ text, submittedAtMs: NOW - 1000 }),
        patterns,
        now: () => NOW,
        maxLines,
        decisionLog: log.child("title-event"),
      },
    );
    return { handled, calls, entries };
  };

  it("renames from a request on the last line inside the limit", async () => {
    const { handled, calls } = run(prompt(12, 10), 10);

    await expect(handled).resolves.toBe(true);
    expect(calls[0]?.title).toBe("abc");
  });

  it("ignores a request on the first line beyond the limit", async () => {
    const { handled, calls } = run(prompt(12, 11), 10);

    await expect(handled).resolves.toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("reads further when the limit is wider", async () => {
    const { handled, calls } = run(prompt(12, 11), 20);

    await expect(handled).resolves.toBe(true);
    expect(calls[0]?.title).toBe("abc");
  });

  it("reads less when the limit is narrower", async () => {
    const { handled } = run(prompt(5, 2), 1);

    await expect(handled).resolves.toBe(false);
  });

  it("counts \\r\\n line breaks the same way", async () => {
    await expect(run(prompt(12, 10, "\r\n"), 10).handled).resolves.toBe(true);
    await expect(run(prompt(12, 11, "\r\n"), 10).handled).resolves.toBe(false);
  });

  it("reads the whole prompt when no limit is given", async () => {
    const { handled } = run(prompt(40, 39), undefined);

    await expect(handled).resolves.toBe(true);
  });

  it("writes the lines read at trace level and nothing beyond the limit anywhere", async () => {
    const { handled, entries } = run(prompt(12, 11), 10);
    await handled;

    const trace = entries.filter((entry) => entry.level === "trace");
    expect(trace).toHaveLength(1);
    expect(trace[0]?.message).toStartWith("[title-event] ");
    expect(trace[0]?.message).toContain('session="chat-1"');
    expect(trace[0]?.message).toContain("lines=10 dropped=2");
    expect(trace[0]?.message).toContain("filler 1");
    expect(trace[0]?.message).toContain("filler 10");
    expect(trace[0]?.message).not.toContain("/vw-spec-start abc");
    expect(entries.filter((entry) => entry.level !== "trace" && entry.message.includes("filler"))).toEqual([]);
  });

  it("still matches a request beyond line 10 in renameChatFromPrompt", async () => {
    const { deps, calls } = makeDeps();

    await expect(renameChatFromPrompt(deps, "chat-1", prompt(40, 39), { patterns })).resolves.toBe(true);
    expect(calls[0]?.title).toBe("abc");
  });
});

describe("catalogTitleDecision", () => {
  const NOW = Date.parse("2026-10-09T15:00:00.000Z");
  const patterns = compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns;
  type Prompt = { text: string; submittedAtMs?: number } | undefined;
  const run = async (
    prompt: Prompt,
    extra: { title?: string; notBeforeMs?: number; rename?: () => Promise<void> } = {},
  ) => {
    const { deps, calls } = makeDeps(extra.rename);
    const { log, entries } = captureLog();
    const result = catalogTitleDecision(
      deps,
      { sessionId: "chat-1", title: extra.title ?? "Anything" },
      {
        readFirstPrompt: async () => prompt,
        patterns,
        now: () => NOW,
        maxLines: 10,
        notBeforeMs: extra.notBeforeMs,
        decisionLog: log.child("title-event"),
      },
    );
    await result.then(
      () => undefined,
      () => undefined,
    );
    return { result, calls, entries: entries.filter((entry) => entry.level !== "trace") };
  };

  it("logs a pattern match that renames, with the pattern index and the final title", async () => {
    const { result, entries } = await run({ text: "/vw-spec-start abc", submittedAtMs: NOW - 1000 });

    await expect(result).resolves.toMatchObject({ outcome: "renamed", decision: "rename", reason: "rename request" });
    expect(entries).toEqual([
      {
        level: "info",
        message:
          '[title-event] decision session="chat-1" matched=true pattern=2 decision="rename" reason="rename request" title="abc"',
      },
    ]);
  });

  it("logs a slash command without a pattern", async () => {
    const { entries } = await run({ text: '/chat-rename "two words"', submittedAtMs: NOW - 1000 });

    expect(entries).toEqual([
      {
        level: "info",
        message:
          '[title-event] decision session="chat-1" matched=true decision="rename" reason="rename request" title="two words"',
      },
    ]);
  });

  it("logs a prompt with no request as not matched", async () => {
    const { result, entries, calls } = await run({ text: "hello there", submittedAtMs: NOW - 1000 });

    await expect(result).resolves.toMatchObject({ outcome: "ignored", decision: "ignore", matched: false });
    expect(calls).toHaveLength(0);
    expect(entries).toEqual([
      {
        level: "info",
        message: '[title-event] decision session="chat-1" matched=false decision="ignore" reason="no rename request"',
      },
    ]);
  });

  it("logs a malformed slash command with the parse reason", async () => {
    const { result, entries, calls } = await run({ text: "/chat-rename two words", submittedAtMs: NOW - 1000 });

    const decision = await result;
    expect(decision).toMatchObject({ decision: "ignore", reason: "malformed request", matched: true });
    expect(decision.detail).toBeString();
    expect(calls).toHaveLength(0);
    expect(entries[0]?.level).toBe("info");
    expect(entries[0]?.message).toContain('matched=true decision="ignore" reason="malformed request" detail=');
  });

  it("logs keep when the chat title already has the requested base", async () => {
    const { result, entries, calls } = await run(
      { text: "/vw-spec-start abc", submittedAtMs: NOW - 1000 },
      { title: "abc7" },
    );

    await expect(result).resolves.toMatchObject({ outcome: "same-base", decision: "keep" });
    expect(calls).toHaveLength(0);
    expect(entries[0]?.message).toContain('decision="keep" reason="current title shares the base"');
  });

  it("logs a chat that existed before startup at debug level", async () => {
    const { result, entries } = await run(
      { text: "/vw-spec-start abc", submittedAtMs: NOW - 5000 },
      { notBeforeMs: NOW - 1000 },
    );

    await expect(result).resolves.toMatchObject({ decision: "ignore", reason: "before startup" });
    expect(entries.map((entry) => entry.level)).toEqual(["debug"]);
    expect(entries[0]?.message).toContain('decision="ignore" reason="before startup"');
  });

  it("logs a first prompt that is too old at debug level", async () => {
    const { result, entries } = await run({ text: "/vw-spec-start abc", submittedAtMs: NOW - 60_000 });

    await expect(result).resolves.toMatchObject({ reason: "too old" });
    expect(entries.map((entry) => entry.level)).toEqual(["debug"]);
  });

  it("logs an unreadable first prompt, and one without a timestamp, at debug level", async () => {
    for (const prompt of [undefined, { text: "/vw-spec-start abc" }]) {
      const { result, entries } = await run(prompt);

      await expect(result).resolves.toMatchObject({ decision: "ignore", reason: "no first prompt" });
      expect(entries.map((entry) => entry.level)).toEqual(["debug"]);
    }
  });

  it("writes no trace line for a chat it skipped before reading the prompt lines", async () => {
    const { deps } = makeDeps();
    const { log, entries } = captureLog();

    await catalogTitleDecision(
      deps,
      { sessionId: "chat-1" },
      {
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc", submittedAtMs: NOW - 60_000 }),
        patterns,
        now: () => NOW,
        maxLines: 10,
        decisionLog: log.child("title-event"),
      },
    );

    expect(entries.filter((entry) => entry.level === "trace")).toEqual([]);
  });

  it("lets a failing rename reject, so the caller can report it", async () => {
    const { result, entries } = await run(
      { text: "/vw-spec-start abc", submittedAtMs: NOW - 1000 },
      {
        rename: async () => {
          throw new Error("gate closed");
        },
      },
    );

    await expect(result).rejects.toThrow("gate closed");
    expect(entries.filter((entry) => entry.message.includes("decision"))).toEqual([]);
  });

  it("keeps the boolean and outcome wrappers", async () => {
    const { deps } = makeDeps();
    const opts = {
      readFirstPrompt: async () => ({ text: "hello", submittedAtMs: NOW - 1000 }),
      now: () => NOW,
    };

    await expect(handleCatalogTitleChange(deps, { sessionId: "chat-1" }, opts)).resolves.toBe(false);
  });
});
