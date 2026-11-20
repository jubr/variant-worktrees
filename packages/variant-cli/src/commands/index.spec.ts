import { describe, expect, it } from "bun:test";
import { CLI_ONLY_COMMANDS, CLI_ONLY_SECTION } from "./index.js";

describe("CLI-only commands", () => {
  it("are ui, mcp and completions, listed in the documentation section cli", () => {
    expect([...CLI_ONLY_COMMANDS]).toEqual(["ui", "mcp", "completions"]);
    expect(CLI_ONLY_SECTION).toBe("cli");
  });
});
