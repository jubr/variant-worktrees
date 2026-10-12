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
});
