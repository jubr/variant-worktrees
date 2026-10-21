import { describe, expect, it } from "bun:test";

import { parseFirstPrompt, readFirstPrompt, readFirstPromptWithRetry } from "./chat-first-prompt";

const header = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    bubbleId: "b-1",
    type: 1,
    grouping: { textPreview: "/chat-rename preview" },
    createdAt: "2026-10-09T14:49:32.475Z",
    ...overrides,
  });

describe("parseFirstPrompt", () => {
  it("prefers the bubble text and reads the submit time from the header", () => {
    expect(parseFirstPrompt(header(), '/chat-rename "full text"')).toEqual({
      text: '/chat-rename "full text"',
      submittedAtMs: Date.parse("2026-10-09T14:49:32.475Z"),
    });
  });

  it("falls back to the header text preview", () => {
    expect(parseFirstPrompt(header(), undefined)?.text).toBe("/chat-rename preview");
    expect(parseFirstPrompt(header(), "   ")?.text).toBe("/chat-rename preview");
  });

  it("returns undefined when neither text is available or the header is unreadable", () => {
    expect(parseFirstPrompt(header({ grouping: {} }), undefined)).toBeUndefined();
    expect(parseFirstPrompt("{ nope", "x")).toBeUndefined();
  });

  it("omits the submit time when the header has no usable date", () => {
    expect(parseFirstPrompt(header({ createdAt: "soon" }), "x")).toEqual({ text: "x" });
  });
});

describe("readFirstPrompt", () => {
  const fakeRunner = (rows: Record<string, string>) => {
    const queries: string[] = [];
    const run = async (_db: string, sql: string): Promise<string> => {
      queries.push(sql);
      const hit = Object.entries(rows).find(([needle]) => sql.includes(needle));
      return hit ? JSON.stringify([{ v: hit[1] }]) : "";
    };
    return { run, queries };
  };

  it("reads the first human bubble header, then its text", async () => {
    const { run, queries } = fakeRunner({
      "composerData:chat-1": header({ bubbleId: "b-9" }),
      "bubbleId:chat-1:b-9": "/chat-rename wanted",
    });

    const result = await readFirstPrompt({ dbPath: "/db", sessionId: "chat-1", run });

    expect(result?.text).toBe("/chat-rename wanted");
    expect(queries).toHaveLength(2);
  });

  it("uses the preview when the bubble row is missing", async () => {
    const { run } = fakeRunner({ "composerData:chat-1": header() });

    expect((await readFirstPrompt({ dbPath: "/db", sessionId: "chat-1", run }))?.text).toBe("/chat-rename preview");
  });

  it("returns undefined when the chat has no human bubble yet", async () => {
    const { run } = fakeRunner({});

    await expect(readFirstPrompt({ dbPath: "/db", sessionId: "chat-1", run })).resolves.toBeUndefined();
  });

  it("returns undefined instead of throwing when the database cannot be read", async () => {
    const run = async () => {
      throw new Error("sqlite3 missing");
    };

    await expect(readFirstPrompt({ dbPath: "/db", sessionId: "chat-1", run })).resolves.toBeUndefined();
  });

  it("never builds SQL from an id that is not a plain id", async () => {
    const { run, queries } = fakeRunner({});

    await expect(readFirstPrompt({ dbPath: "/db", sessionId: "x'; drop table t;--", run })).resolves.toBeUndefined();
    expect(queries).toHaveLength(0);
  });
});

describe("readFirstPromptWithRetry", () => {
  it("returns as soon as the prompt shows up", async () => {
    let calls = 0;
    const read = async () => (++calls === 3 ? { text: "hi" } : undefined);

    await expect(readFirstPromptWithRetry(read, 6, 0)).resolves.toEqual({ text: "hi" });
    expect(calls).toBe(3);
  });

  it("gives up after the given attempts", async () => {
    let calls = 0;
    const read = async () => {
      calls++;
      return undefined;
    };

    await expect(readFirstPromptWithRetry(read, 4, 0)).resolves.toBeUndefined();
    expect(calls).toBe(4);
  });
});
