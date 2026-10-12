import { describe, expect, it } from "bun:test";

import { renameExistingChats } from "./chat-existing-rename";
import { compilePatterns, DEFAULT_ACTIVATION_PATTERNS } from "./chat-rename-patterns";
import type { ChatRenameDeps } from "./cursor-chat-rename";

const STARTED = Date.parse("2026-10-12T09:00:00.000Z");
const patterns = compilePatterns(DEFAULT_ACTIVATION_PATTERNS).patterns;

type Session = { sessionId: string; title?: string; updatedAt?: number };
type Prompt = { text: string; submittedAtMs?: number } | undefined;

const setup = (sessions: Session[], prompts: Record<string, Prompt>) => {
  const renamed: Array<{ sessionId: string; title: string; asBuiltin: boolean }> = [];
  const mine = { identifier: { value: "me" }, isBuiltin: false, enabledApiProposals: [] as string[] };
  const deps: ChatRenameDeps = {
    mine,
    donor: { identifier: { value: "anysphere.cursor-agent-host" }, isBuiltin: true, enabledApiProposals: ["cursor"] },
    cursor: {
      listAgentHostSessionCatalog: async () => sessions,
      projectAgentHostSessionTitle: async (sessionId, title) => {
        renamed.push({ sessionId, title, asBuiltin: mine.isBuiltin });
      },
    },
  };
  const reads: string[] = [];
  const recorded: string[][] = [];
  const options = {
    patterns,
    startedAtMs: STARTED,
    readFirstPrompt: async (sessionId: string) => {
      reads.push(sessionId);
      return prompts[sessionId];
    },
    record: (ids: string[]) => {
      recorded.push(ids);
    },
  };
  return { deps, options, renamed, reads, recorded };
};

const old = (text: string, ageMs: number) => ({ text, submittedAtMs: STARTED - ageMs });

const DAY = 86_400_000;

describe("renameExistingChats window", () => {
  it("leaves chats created before the window alone and does not record them", async () => {
    const { deps, options, renamed, recorded } = setup([{ sessionId: "inside" }, { sessionId: "outside" }], {
      inside: old("/vw-spec-start abc", 2 * DAY),
      outside: old("/vw-spec-start abc", 9 * DAY),
    });

    const result = await renameExistingChats(deps, { ...options, notBeforeMs: STARTED - 7 * DAY });

    expect(renamed.map((entry) => entry.sessionId)).toEqual(["inside"]);
    expect(recorded).toEqual([["inside"]]);
    expect(result.examined).toBe(1);
  });

  it("numbers only the chats inside the window", async () => {
    const { deps, options, renamed } = setup(
      [{ sessionId: "outside" }, { sessionId: "first" }, { sessionId: "second" }],
      {
        outside: old("/vw-spec-start abc", 9 * DAY),
        first: old("/vw-spec-start abc", 3 * DAY),
        second: old("/vw-spec-start abc", 2 * DAY),
      },
    );

    await renameExistingChats(deps, { ...options, notBeforeMs: STARTED - 7 * DAY });

    expect(renamed.map(({ sessionId, title }) => ({ sessionId, title }))).toEqual([
      { sessionId: "first", title: "abc" },
      { sessionId: "second", title: "abc2" },
    ]);
  });

  it("skips without reading a chat last updated before the window", async () => {
    const { deps, options, reads } = setup(
      [
        { sessionId: "stale", updatedAt: STARTED - 10 * DAY },
        { sessionId: "recent", updatedAt: STARTED - DAY },
      ],
      { stale: old("/vw-spec-start abc", 11 * DAY), recent: old("/vw-spec-start abc", 2 * DAY) },
    );

    await renameExistingChats(deps, { ...options, notBeforeMs: STARTED - 7 * DAY });

    expect(reads).toEqual(["recent"]);
  });

  it("ignores an updatedAt that is not in epoch milliseconds", async () => {
    const { deps, options, reads } = setup([{ sessionId: "seconds", updatedAt: 1_700_000_000 }], {
      seconds: old("/vw-spec-start abc", DAY),
    });

    await renameExistingChats(deps, { ...options, notBeforeMs: STARTED - 7 * DAY });

    expect(reads).toEqual(["seconds"]);
  });

  it("has no lower bound without notBeforeMs", async () => {
    const { deps, options, renamed } = setup([{ sessionId: "ancient" }], {
      ancient: old("/vw-spec-start abc", 3000 * DAY),
    });

    await renameExistingChats(deps, options);

    expect(renamed).toHaveLength(1);
  });
});

describe("renameExistingChats", () => {
  it("renames same-titled old chats in creation order, oldest first", async () => {
    const { deps, options, renamed } = setup(
      [
        { sessionId: "newest", title: "AI 3" },
        { sessionId: "oldest", title: "AI 1" },
        { sessionId: "middle", title: "AI 2" },
      ],
      {
        newest: old("/vw-spec-start abc", 1_000),
        oldest: old("/vw-spec-start abc", 3_000),
        middle: old("/vw-spec-start abc", 2_000),
      },
    );

    const result = await renameExistingChats(deps, options);

    expect(renamed.map(({ sessionId, title }) => ({ sessionId, title }))).toEqual([
      { sessionId: "oldest", title: "abc" },
      { sessionId: "middle", title: "abc2" },
      { sessionId: "newest", title: "abc3" },
    ]);
    expect(result.renamed).toHaveLength(3);
    expect(result.listed).toBe(3);
  });

  it("reports the old title and creation time of every rename", async () => {
    const { deps, options } = setup([{ sessionId: "a", title: "AI name" }], { a: old("/vw-spec-start abc", 5_000) });

    const result = await renameExistingChats(deps, options);

    expect(result.renamed).toEqual([
      { sessionId: "a", title: "abc", previousTitle: "AI name", createdAtMs: STARTED - 5_000 },
    ]);
  });

  it("renames through the borrowed identity", async () => {
    const { deps, options, renamed } = setup([{ sessionId: "a", title: "AI" }], {
      a: old("/vw-spec-start abc", 1_000),
    });

    await renameExistingChats(deps, options);

    expect(renamed[0]?.asBuiltin).toBe(true);
    expect(deps.mine.isBuiltin).toBe(false);
  });

  it("leaves chats created after startup to the realtime path", async () => {
    const { deps, options, renamed } = setup([{ sessionId: "fresh", title: "AI" }], {
      fresh: { text: "/vw-spec-start abc", submittedAtMs: STARTED + 1_000 },
    });

    await renameExistingChats(deps, options);

    expect(renamed).toEqual([]);
  });

  it("skips chats an earlier run recorded without reading them", async () => {
    const { deps, options, renamed, reads } = setup([{ sessionId: "seen", title: "My own name" }], {
      seen: old("/vw-spec-start abc", 1_000),
    });

    await renameExistingChats(deps, { ...options, isRecorded: (id) => id === "seen" });

    expect(renamed).toEqual([]);
    expect(reads).toEqual([]);
  });

  it("examines recorded chats again when no record check is given", async () => {
    const { deps, options, renamed } = setup([{ sessionId: "seen", title: "My own name" }], {
      seen: old("/vw-spec-start abc", 1_000),
    });

    await renameExistingChats(deps, options);

    expect(renamed.map((entry) => entry.title)).toEqual(["abc"]);
  });

  it("records every chat with a readable, timestamped prompt, and no other", async () => {
    const { deps, options, recorded } = setup(
      [{ sessionId: "match" }, { sessionId: "plain" }, { sessionId: "unreadable" }, { sessionId: "untimed" }],
      {
        match: old("/vw-spec-start abc", 1_000),
        plain: old("fix the build", 1_000),
        unreadable: undefined,
        untimed: { text: "/vw-spec-start def" },
      },
    );

    const result = await renameExistingChats(deps, options);

    expect(recorded).toEqual([["match", "plain"]]);
    expect(result.examined).toBe(2);
  });

  it("does not rename a chat that already has its planned title", async () => {
    const { deps, options, renamed } = setup([{ sessionId: "a", title: "abc" }], {
      a: old("/vw-spec-start abc", 1_000),
    });

    await renameExistingChats(deps, options);

    expect(renamed).toEqual([]);
  });

  it("uses a slash command title literally", async () => {
    const { deps, options, renamed } = setup(
      [
        { sessionId: "a", title: "x" },
        { sessionId: "b", title: "y" },
      ],
      { a: old("/vw-spec-start abc", 2_000), b: old("/chat-rename abc", 1_000) },
    );

    await renameExistingChats(deps, options);

    expect(renamed.map(({ sessionId, title }) => ({ sessionId, title }))).toEqual([
      { sessionId: "a", title: "abc" },
      { sessionId: "b", title: "abc" },
    ]);
  });

  it("keeps going when one rename fails and reports it", async () => {
    const { deps, options } = setup(
      [
        { sessionId: "a", title: "x" },
        { sessionId: "b", title: "y" },
      ],
      { a: old("/vw-spec-start abc", 2_000), b: old("/vw-spec-start def", 1_000) },
    );
    const done: string[] = [];
    deps.cursor = {
      ...deps.cursor,
      projectAgentHostSessionTitle: async (sessionId) => {
        if (sessionId === "a") {
          throw new Error("gate closed");
        }
        done.push(sessionId);
      },
    };

    const result = await renameExistingChats(deps, options);

    expect(done).toEqual(["b"]);
    expect(result.failed).toEqual([{ sessionId: "a", error: "gate closed" }]);
    expect(result.renamed.map((entry) => entry.sessionId)).toEqual(["b"]);
  });

  it("fails clearly when the catalog is not available", async () => {
    const { deps, options } = setup([], {});
    deps.cursor = {};

    await expect(renameExistingChats(deps, options)).rejects.toThrow("listAgentHostSessionCatalog");
  });
});
