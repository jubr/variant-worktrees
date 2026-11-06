/**
 * Specification: openspec/specs/meta/dev-bleeds/spec.md
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type Task = { desc?: string; cmds?: Array<string | { task?: string }> };

const tasks = parse(readFileSync(join(import.meta.dir, "..", "Taskfile.yaml"), "utf8")).tasks as Record<string, Task>;

const command = (task: Task, index: number): string => {
  const entry = task.cmds?.[index];
  if (typeof entry === "string") {
    return entry;
  }
  return entry?.task ?? "";
};

describe("bleed tasks", () => {
  test("defines bleed:vsix, bleed:cli, bleed:mcp, and bleed:all, and drops package:vsix:unpacked", () => {
    expect(tasks["package:vsix:unpacked"]).toBeUndefined();
    expect(tasks["package:vsix"]).toBeDefined();
    expect(tasks["package:cli"]).toBeDefined();
    expect(tasks["bleed:vsix"]?.cmds?.map((entry) => (typeof entry === "string" ? entry : entry.task))).toEqual([
      "mkdir -p {{.ROOT_DIR}}/../vw-bleeds",
      "build",
      "bun run --filter ./packages/variant-vscode vsce-package",
      "bun scripts/package-vsix-unpacked.ts",
    ]);
    expect(command(tasks["bleed:cli"] as Task, 0)).toBe("mkdir -p {{.ROOT_DIR}}/../vw-bleeds");
    expect(command(tasks["bleed:cli"] as Task, 1)).toBe("build");
    expect(command(tasks["bleed:cli"] as Task, 2)).toBe("bun scripts/bleed.ts cli");
    expect(command(tasks["bleed:mcp"] as Task, 0)).toBe("mkdir -p {{.ROOT_DIR}}/../vw-bleeds");
    expect(command(tasks["bleed:mcp"] as Task, 1)).toBe("build");
    expect(command(tasks["bleed:mcp"] as Task, 2)).toBe("bun scripts/bleed.ts mcp");
    expect(tasks["bleed:all"]?.cmds).toEqual([{ task: "bleed:vsix" }, { task: "bleed:cli" }, { task: "bleed:mcp" }]);
  });
});
