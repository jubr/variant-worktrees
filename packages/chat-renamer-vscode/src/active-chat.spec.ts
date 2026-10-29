import { describe, expect, it } from "bun:test";

import { chooseActiveChat } from "./active-chat";

/**
 * Specification: openspec/specs/chat-renamer/chat-renaming/spec.md
 */
describe("chooseActiveChat", () => {
  it("takes the first selected id when the catalog lists none of them", () => {
    const choice = chooseActiveChat(["first", "second"], []);

    expect(choice).toEqual({ id: "first", rule: "first selected", ids: ["first", "second"], chats: [] });
  });

  it("takes the selected chat the catalog lists as newest", () => {
    const pane = { sessionId: "pane-chat", title: "A", updatedAt: 1000 };
    const editor = { sessionId: "editor-chat", title: "B", updatedAt: 2000 };

    const choice = chooseActiveChat(
      ["pane-chat", "editor-chat"],
      [pane, editor, { sessionId: "other", updatedAt: 9000 }],
    );

    expect(choice).toEqual({
      id: "editor-chat",
      rule: "newest selected",
      ids: ["pane-chat", "editor-chat"],
      chats: [pane, editor],
    });
  });

  it("falls back to the newest chat in the catalog when nothing is selected", () => {
    const old = { sessionId: "old", updatedAt: 100 };
    const recent = { sessionId: "recent", updatedAt: 300 };
    const middle = { sessionId: "middle", updatedAt: 200 };

    for (const selection of [[], undefined, "nope", {}]) {
      expect(chooseActiveChat(selection, [old, recent, middle])).toEqual({
        id: "recent",
        rule: "newest in catalog",
        ids: [],
        chats: [recent],
      });
    }
  });

  it("finds no chat when nothing is selected and the catalog lists none", () => {
    expect(chooseActiveChat([], [])).toEqual({ rule: "none", ids: [], chats: [] });
  });

  it("counts objects that carry the id and ignores every other value", () => {
    const selection = [
      { composerId: "c1" },
      { sessionId: "c2" },
      { id: "c3" },
      "c4",
      { other: "x" },
      { composerId: 7 },
      "",
      null,
      42,
    ];

    expect(chooseActiveChat(selection, []).ids).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("keeps the first selected chat on a tie and ranks a missing or non-finite updatedAt lowest", () => {
    const tie = [
      { sessionId: "a", updatedAt: 5 },
      { sessionId: "b", updatedAt: 5 },
    ];
    expect(chooseActiveChat(["a", "b"], tie).id).toBe("a");

    const unknown = [{ sessionId: "a" }, { sessionId: "b", updatedAt: Number.NaN }, { sessionId: "c", updatedAt: 1 }];
    expect(chooseActiveChat(["a", "b", "c"], unknown).id).toBe("c");
    expect(chooseActiveChat(["a", "b"], unknown).id).toBe("a");
  });
});
