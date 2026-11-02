import { describe, expect, it } from "bun:test";
import { autoExpandEnabled, expandVariantsView } from "./variants-expand.ts";

describe("expanding the Variant Worktrees section", () => {
  it("expands the section and returns focus to the editor", async () => {
    const commands: string[] = [];

    await expandVariantsView(true, async (command) => {
      commands.push(command);
    });

    expect(commands).toEqual(["variant.variants.focus", "workbench.action.focusActiveEditorGroup"]);
  });

  it("does nothing when auto-expand is off", async () => {
    const commands: string[] = [];

    await expandVariantsView(false, async (command) => {
      commands.push(command);
    });

    expect(commands).toEqual([]);
  });

  it("treats an unset setting as on and an explicit false as off", () => {
    expect(autoExpandEnabled(undefined)).toBe(true);
    expect(autoExpandEnabled(true)).toBe(true);
    expect(autoExpandEnabled(false)).toBe(false);
  });
});
