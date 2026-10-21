import { describe, expect, it } from "bun:test";

import { type ExistingChat, planExistingRenames } from "./chat-existing-plan";

const chat = (
  sessionId: string,
  createdAtMs: number,
  title: string,
  extra: Partial<ExistingChat> = {},
): ExistingChat => ({
  sessionId,
  createdAtMs,
  request: { title, viaPattern: true },
  ...extra,
});

describe("planExistingRenames", () => {
  it("renames a lone chat to its derived title", () => {
    expect(planExistingRenames([chat("a", 1, "abc", { currentTitle: "AI title" })])).toEqual([
      { sessionId: "a", title: "abc" },
    ]);
  });

  it("numbers same-titled chats from the oldest: plain, 2, 3", () => {
    const plan = planExistingRenames([
      chat("a", 1, "abc", { currentTitle: "x" }),
      chat("b", 2, "abc", { currentTitle: "y" }),
      chat("c", 3, "abc", { currentTitle: "z" }),
    ]);

    expect(plan).toEqual([
      { sessionId: "a", title: "abc" },
      { sessionId: "b", title: "abc2" },
      { sessionId: "c", title: "abc3" },
    ]);
  });

  it("does not depend on the order the chats are listed in", () => {
    const chats = [
      chat("c", 3, "abc", { currentTitle: "z" }),
      chat("a", 1, "abc", { currentTitle: "x" }),
      chat("b", 2, "abc", { currentTitle: "y" }),
    ];

    expect(planExistingRenames(chats)).toEqual(planExistingRenames([...chats].reverse()));
    expect(planExistingRenames(chats).map((entry) => entry.title)).toEqual(["abc", "abc2", "abc3"]);
  });

  it("drops typed numbers and compares bases case-insensitively", () => {
    const plan = planExistingRenames([
      chat("a", 1, "abc7", { currentTitle: "x" }),
      chat("b", 2, "ABC", { currentTitle: "y" }),
      chat("c", 3, "abc3", { currentTitle: "z" }),
    ]);

    expect(plan.map((entry) => entry.title)).toEqual(["abc", "abc2", "abc3"]);
  });

  it("keeps separate groups apart", () => {
    const plan = planExistingRenames([
      chat("a", 1, "abc", { currentTitle: "x" }),
      chat("b", 2, "def", { currentTitle: "y" }),
      chat("c", 3, "abc", { currentTitle: "z" }),
    ]);

    expect(plan).toEqual([
      { sessionId: "a", title: "abc" },
      { sessionId: "b", title: "def" },
      { sessionId: "c", title: "abc2" },
    ]);
  });

  it("orders chats created at the same moment by id", () => {
    const plan = planExistingRenames([
      chat("b", 5, "abc", { currentTitle: "y" }),
      chat("a", 5, "abc", { currentTitle: "x" }),
    ]);

    expect(plan).toEqual([
      { sessionId: "a", title: "abc" },
      { sessionId: "b", title: "abc2" },
    ]);
  });

  it("uses a slash title as written and leaves it out of the numbering", () => {
    const plan = planExistingRenames([
      chat("a", 1, "abc", { currentTitle: "x" }),
      chat("s", 2, "abc", { currentTitle: "y", request: { title: "abc", viaPattern: false } }),
      chat("b", 3, "abc", { currentTitle: "z" }),
    ]);

    expect(plan).toEqual([
      { sessionId: "a", title: "abc" },
      { sessionId: "s", title: "abc" },
      { sessionId: "b", title: "abc2" },
    ]);
  });

  it("leaves out chats whose title already is the planned one", () => {
    const plan = planExistingRenames([
      chat("a", 1, "abc", { currentTitle: "abc" }),
      chat("b", 2, "abc", { currentTitle: "AI title" }),
    ]);

    expect(plan).toEqual([{ sessionId: "b", title: "abc2" }]);
  });

  it("keeps an all-digit title as typed", () => {
    expect(
      planExistingRenames([chat("a", 1, "123", { currentTitle: "x" }), chat("b", 2, "123", { currentTitle: "y" })]),
    ).toEqual([
      { sessionId: "a", title: "123" },
      { sessionId: "b", title: "123" },
    ]);
  });

  it("returns nothing for no chats", () => {
    expect(planExistingRenames([])).toEqual([]);
  });

  describe("a chat that already has the requested base", () => {
    it("is left alone, whatever its number", () => {
      expect(planExistingRenames([chat("a", 1, "abc", { currentTitle: "abc3" })])).toEqual([]);
    });

    it("is left alone regardless of case", () => {
      expect(planExistingRenames([chat("a", 1, "abc", { currentTitle: "ABC" })])).toEqual([]);
    });

    it("is not left alone for a slash title, which is literal", () => {
      const plan = planExistingRenames([
        chat("a", 1, "abc", { currentTitle: "abc3", request: { title: "abc", viaPattern: false } }),
      ]);

      expect(plan).toEqual([{ sessionId: "a", title: "abc" }]);
    });

    it("holds its number, so the others take the next free ones in creation order", () => {
      const plan = planExistingRenames([
        chat("a", 1, "abc", { currentTitle: "abc" }),
        chat("b", 2, "abc", { currentTitle: "x" }),
        chat("c", 3, "abc", { currentTitle: "y" }),
      ]);

      expect(plan).toEqual([
        { sessionId: "b", title: "abc2" },
        { sessionId: "c", title: "abc3" },
      ]);
    });

    it("holds the plain title even when it is newer than a chat that needs a name", () => {
      const plan = planExistingRenames([
        chat("old", 1, "abc", { currentTitle: "x" }),
        chat("new", 2, "abc", { currentTitle: "abc" }),
      ]);

      expect(plan).toEqual([{ sessionId: "old", title: "abc2" }]);
    });

    it("skips the numbers held by untouched chats", () => {
      const plan = planExistingRenames([
        chat("a", 1, "abc", { currentTitle: "x" }),
        chat("b", 2, "abc", { currentTitle: "abc2" }),
        chat("c", 3, "abc", { currentTitle: "y" }),
        chat("d", 4, "abc", { currentTitle: "z" }),
      ]);

      expect(plan).toEqual([
        { sessionId: "a", title: "abc" },
        { sessionId: "c", title: "abc3" },
        { sessionId: "d", title: "abc4" },
      ]);
    });

    it("only counts chats of its own group", () => {
      const plan = planExistingRenames([
        chat("a", 1, "def", { currentTitle: "abc" }),
        chat("b", 2, "abc", { currentTitle: "x" }),
      ]);

      expect(plan).toEqual([
        { sessionId: "a", title: "def" },
        { sessionId: "b", title: "abc" },
      ]);
    });
  });
});
