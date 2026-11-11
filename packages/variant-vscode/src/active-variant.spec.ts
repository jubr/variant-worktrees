import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeVariant } from "./active-variant.ts";

describe("active variant", () => {
  it("returns the worktree slug when the file is inside that directory", () => {
    expect(activeVariant("/work/_v-demo/src/a.ts", [{ slug: "demo", directory: "/work/_v-demo" }])).toBe("demo");
  });

  it("returns main when the file is inside the main checkout", () => {
    expect(activeVariant("/work/app/src/a.ts", [{ slug: "main", directory: "/work/app" }])).toBe("main");
  });

  it("returns the longer worktree when the main checkout is a parent", () => {
    expect(
      activeVariant("/work/_v-demo/src/a.ts", [
        { slug: "main", directory: "/work" },
        { slug: "demo", directory: "/work/_v-demo" },
      ]),
    ).toBe("demo");
  });

  it("returns none when the path only shares a prefix with the worktree", () => {
    expect(
      activeVariant("/work/_v-demo-extra/a.ts", [
        { slug: "demo", directory: "/work/_v-demo" },
        { slug: "main", directory: "/work/app" },
      ]),
    ).toBeUndefined();
  });

  it("compares a path that is not on disk", () => {
    expect(activeVariant("/missing/_v-demo/src/a.ts", [{ slug: "demo", directory: "/missing/_v-demo" }])).toBe("demo");
  });

  it("compares a missing path after collapsing parent segments", () => {
    expect(activeVariant("/missing/other/../_v-demo/src/a.ts", [{ slug: "demo", directory: "/missing/_v-demo" }])).toBe(
      "demo",
    );
  });

  it("matches a symlink that resolves inside the worktree", () => {
    const root = mkdtempSync(join(tmpdir(), "active-variant-"));
    try {
      const worktree = join(root, "_v-demo");
      mkdirSync(join(worktree, "src"), { recursive: true });
      writeFileSync(join(worktree, "src", "a.ts"), "");
      const alias = join(root, "alias");
      const link = join(root, "link-a.ts");
      symlinkSync(worktree, alias);
      symlinkSync(join(worktree, "src", "a.ts"), link);

      expect(activeVariant(link, [{ slug: "demo", directory: alias }])).toBe("demo");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
