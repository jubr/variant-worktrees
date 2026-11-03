import { describe, expect, it } from "bun:test";
import { formatUptime, stateOf } from "./state.js";

describe("formatUptime", () => {
  it.each([
    [0, "0s"],
    [59, "59s"],
    [125, "2m 5s"],
    [3600, "1h 0m"],
    [3700, "1h 1m"],
    [90000, "1d 1h"],
  ])("formats %d seconds as %s", (seconds, expected) => {
    expect(formatUptime(seconds)).toBe(expected);
  });
});

describe("stateOf", () => {
  it("is watching for mode watch with a live watch", () => {
    expect(stateOf({ slug: "a", mode: "watch", watches: { fe: { alive: true } } })).toEqual({
      state: "watching",
      stale: false,
    });
  });

  it("is up for mode up with a live watch", () => {
    expect(stateOf({ slug: "a", mode: "up", watches: { fe: { alive: true }, be: { alive: false } } })).toEqual({
      state: "up",
      stale: false,
    });
  });

  it("is down without a mode", () => {
    expect(stateOf({ slug: "a" })).toEqual({ state: "down", stale: false });
  });

  it("is down and stale when the recorded mode has no live watch", () => {
    expect(stateOf({ slug: "a", mode: "watch", watches: { fe: { alive: false } } })).toEqual({
      state: "down",
      stale: true,
    });
    expect(stateOf({ slug: "a", mode: "up" })).toEqual({ state: "down", stale: true });
  });

  it("does not count the UI server of main as a live watch", () => {
    expect(stateOf({ slug: "main", watches: { "variant-ui": { alive: true } } })).toEqual({
      state: "down",
      stale: false,
    });
  });
});
