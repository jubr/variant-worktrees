import { describe, expect, it } from "bun:test";

import { numberedTitle } from "./chat-title-numbering";

describe("numberedTitle", () => {
  it.each([
    [[], "abc", "abc"],
    [["other"], "abc", "abc"],
    [["abc"], "abc", "abc2"],
    [["def3", "def5"], "def", "def6"],
    [["def3", "def5"], "def3", "def3"],
    [["abc"], "abc7", "abc7"],
    [["abcd", "other"], "abc", "abc"],
    [["abc", "abc"], "abc", "abc2"],
    [["abc", "abc2"], "abc", "abc3"],
    [["abc10", "abc9"], "abc", "abc11"],
    [["ABC"], "abc", "abc2"],
    [["abc-2"], "abc", "abc"],
    [["abcd"], "abc", "abc"],
    [["abc", "xyz4"], "abc", "abc2"],
  ])("peers %p, candidate %p -> %p", (peers, candidate, expected) => {
    expect(numberedTitle(candidate, peers)).toBe(expected);
  });

  it("keeps an all-digit candidate unchanged", () => {
    expect(numberedTitle("123", ["123"])).toBe("123");
  });

  it("keeps a typed candidate as is when no peer shares its base", () => {
    expect(numberedTitle("foo3", ["bar"])).toBe("foo3");
  });
});
