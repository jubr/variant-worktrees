import { describe, expect, it } from "bun:test";

import { compilePatterns, DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";
import {
  type ChatRenameDeps,
  type Description,
  handleCatalogTitleChange,
  handleChatRenameUri,
  listPeerTitles,
  renameChat,
  renameChatFromPrompt,
  subscribeCatalogTitleChanges,
} from "./cursor-chat-rename";

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
  it("renames when the new title is itself a /chat-rename request", async () => {
    const { deps, calls } = makeDeps();

    await expect(
      handleCatalogTitleChange(deps, { sessionId: "chat-1", title: '/chat-rename "wanted name"' }),
    ).resolves.toBe(true);
    expect(calls[0]?.id).toBe("chat-1");
    expect(calls[0]?.title).toBe("wanted name");
  });

  it("leaves ordinary and malformed titles alone", async () => {
    const { deps, calls } = makeDeps();

    await expect(handleCatalogTitleChange(deps, { sessionId: "c", title: "Fix build" })).resolves.toBe(false);
    await expect(handleCatalogTitleChange(deps, { sessionId: "c", title: "/chat-rename two words" })).resolves.toBe(
      false,
    );
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

  it("falls back to the title when the first prompt cannot be read", async () => {
    const { deps, calls } = makeDeps();

    const handled = await handleCatalogTitleChange(
      deps,
      { sessionId: "chat-1", title: '/chat-rename "from the title"' },
      options(undefined),
    );

    expect(handled).toBe(true);
    expect(calls[0]?.title).toBe("from the title");
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
      { readFirstPrompt: async () => ({ text: "/vw-spec-iterate abc" }), ...peers("abc", "abc2") },
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
