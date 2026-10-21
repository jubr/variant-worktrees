import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

const withProject = async (
  run: (
    directory: string,
    put: (path: string, content: string) => void,
    list: () => ReturnType<ReturnType<typeof createClient>["list"]>,
  ) => Promise<void>,
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-list-")));
  const put = (path: string, content: string): void => {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  try {
    put("variants.yaml", "db:\n  dialect: sqlite\n");
    const list = () =>
      createClient({
        config: loadConfig({ cwd: directory, env: {} }),
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      }).list();
    await run(directory, put, list);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const deadPid = (): number => spawnSync("true").pid;

describe("list with runtime facts", () => {
  it("merges the runtime file of a worktree into the record of its slug", () =>
    withProject(async (directory, put, list) => {
      put(
        "_v-demo/variants.local.yaml",
        [
          "runtime:",
          "  slug: demo",
          "  mode: watch",
          "  instances:",
          "    be: { port: 62061 }",
          "    fe: { port: 62060, url: 'http://demo.vw.localhost:62060' }",
          "",
        ].join("\n"),
      );

      const record = (await list()).find((variant) => variant.slug === "demo");

      expect(record).toMatchObject({
        slug: "demo",
        worktree: join(directory, "_v-demo"),
        mode: "watch",
        url: "http://demo.vw.localhost:62060",
        instances: { be: { port: 62061 }, fe: { port: 62060, url: "http://demo.vw.localhost:62060" } },
      });
    }));

  it("reports whether each recorded pid is alive", () =>
    withProject(async (_directory, put, list) => {
      put(
        "_v-demo/variants.local.yaml",
        `runtime:\n  slug: demo\n  instances:\n    fe: { pid: ${process.pid} }\n    be: { pid: ${deadPid()} }\n`,
      );

      const record = (await list()).find((variant) => variant.slug === "demo");

      expect(record?.instances?.fe).toEqual({ pid: process.pid, alive: true });
      expect(record?.instances?.be?.alive).toBe(false);
    }));

  it("takes values from the state file before the runtime file", () =>
    withProject(async (directory, put, list) => {
      put(
        ".cache/variants/demo.yaml",
        `slug: demo\ntarget: ${join(directory, ".cache", "variants", "demo.db")}\ndialect: sqlite\nstatePath: ""\nworktree: /from/state\ncreatedAt: now\n`,
      );
      put("_v-demo/variants.local.yaml", "runtime:\n  slug: demo\n  mode: up\n");

      const record = (await list()).find((variant) => variant.slug === "demo");

      expect(record).toMatchObject({ worktree: "/from/state", mode: "up" });
    }));

  it("lists the main checkout's runtime under its own slug", () =>
    withProject(async (_directory, put, list) => {
      put("variants.local.yaml", "runtime:\n  slug: main\n  mode: watch\n");

      expect((await list()).find((variant) => variant.slug === "main")?.mode).toBe("watch");
    }));

  it("lists a database-only variant without directory, mode or URL", () =>
    withProject(async (directory, put, list) => {
      put(".cache/variants/orphan.db", "");

      const record = (await list()).find((variant) => variant.slug === "orphan");

      expect(record).toBeDefined();
      expect(record?.target).toBe(join(directory, ".cache", "variants", "orphan.db"));
      expect(record?.worktree).toBeUndefined();
      expect(record?.mode).toBeUndefined();
      expect(record?.url).toBeUndefined();
    }));

  it("still lists the other variants when one runtime file is invalid", () =>
    withProject(async (_directory, put, list) => {
      put("_v-bad/variants.local.yaml", "runtime:\n  nope: 1\n");
      put("_v-demo/variants.local.yaml", "runtime:\n  slug: demo\n");

      expect((await list()).map((variant) => variant.slug)).toEqual(["demo"]);
    }));
});
