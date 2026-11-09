import { describe, expect, it } from "bun:test";
import { autoExpandEnabled, expandVariantsView } from "./variants-expand.ts";

interface Reveal {
  element: unknown;
  options?: { select?: boolean; focus?: boolean };
}

const tree = () => {
  const revealed: Reveal[] = [];
  return {
    revealed,
    reveal: async (element: undefined, options: { select: boolean; focus: boolean }) => {
      revealed.push({ element, options });
    },
  };
};

describe("expanding the Variant Worktrees section", () => {
  it("expands the Explorer root without focusing or selecting it", async () => {
    const explorer = tree();

    await expandVariantsView(true, explorer);

    expect(explorer.revealed).toEqual([{ element: undefined, options: { select: false, focus: false } }]);
  });

  it("does nothing when auto-expand is off", async () => {
    const explorer = tree();

    await expandVariantsView(false, explorer);

    expect(explorer.revealed).toEqual([]);
  });

  it("treats an unset setting as on and an explicit false as off", () => {
    expect(autoExpandEnabled(undefined)).toBe(true);
    expect(autoExpandEnabled(true)).toBe(true);
    expect(autoExpandEnabled(false)).toBe(false);
  });
});
