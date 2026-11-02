import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const lines = (...entries: string[]): string => `${entries.join("\n")}\n`;

const CONFIG = lines(
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  storage: {}",
  "  instances:",
  "    fe: { kind: vite, dir: fe }",
);

interface Project {
  repo: string;
  worktree: string;
  list: () => ReturnType<ReturnType<typeof createClient>["list"]>;
  commit: (path: string, content: string) => void;
}

const withProject = async (run: (project: Project) => Promise<void>, yaml: string = CONFIG): Promise<void> => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-clean-")));
  const repo = join(parent, "repo");
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git(repo, "config", "user.email", "variant@example.test");
    git(repo, "config", "user.name", "Variant Tests");
    const files: Record<string, string> = {
      "variants.yaml": yaml,
      ".gitignore": "variants.local.yaml\n.cache\n_v-*\n.storage\n",
      "bun.lock": "lock v1\n",
      "src/a.ts": "export const a = 1;\n",
      "fe/package.json": "{}\n",
    };
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(repo, path, ".."), { recursive: true });
      writeFileSync(join(repo, path), content);
    }
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "initial");
    const client = createClient({
      config: loadConfig({ cwd: repo, env: {} }),
      cwd: repo,
      stateDir: join(repo, ".cache", "variants"),
    });
    const created = await client.create("demo");
    const worktree = created.worktree as string;
    await run({
      repo,
      worktree,
      list: () => client.list(),
      commit: (path, content) => {
        mkdirSync(join(worktree, path, ".."), { recursive: true });
        writeFileSync(join(worktree, path), content);
        git(worktree, "add", path);
        git(worktree, "commit", "-q", "-m", `change ${path}`);
      },
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

describe("implode cleanliness", () => {
  it("reports a merged worktree with nothing implode would keep as clean, and deletes nothing", () =>
    withProject(async ({ list, worktree }) => {
      const record = (await list()).find((variant) => variant.slug === "demo");

      expect(record?.implodeClean).toBe(true);
      expect(existsSync(join(worktree, "src", "a.ts"))).toBe(true);
    }));

  it("reports unmerged work as not clean and deletes nothing", () =>
    withProject(async ({ list, commit, worktree }) => {
      commit("src/b.ts", "export const b = 2;\n");

      const record = (await list()).find((variant) => variant.slug === "demo");

      expect(record?.implodeClean).toBe(false);
      expect(existsSync(join(worktree, "src", "b.ts"))).toBe(true);
    }));

  it("reports a modified tracked source file as not clean", () =>
    withProject(async ({ list, worktree }) => {
      writeFileSync(join(worktree, "src", "a.ts"), "export const a = 2;\n");

      expect((await list()).find((variant) => variant.slug === "demo")?.implodeClean).toBe(false);
      expect(existsSync(join(worktree, "src", "a.ts"))).toBe(true);
    }));

  it("treats an untracked file inside a preRm directory as clean and leaves it in place", () =>
    withProject(async ({ list, worktree }) => {
      mkdirSync(join(worktree, "fe", "dist"));
      writeFileSync(join(worktree, "fe", "dist", "out.js"), "x");

      expect((await list()).find((variant) => variant.slug === "demo")?.implodeClean).toBe(true);
      expect(existsSync(join(worktree, "fe", "dist", "out.js"))).toBe(true);
    }, `${CONFIG}  implode: { preRm: [dist] }\n`));

  it("treats a tracked modification whose base name is in restore as clean and leaves the file", () =>
    withProject(async ({ list, worktree }) => {
      writeFileSync(join(worktree, "bun.lock"), "lock v2\n");

      expect((await list()).find((variant) => variant.slug === "demo")?.implodeClean).toBe(true);
      expect(existsSync(join(worktree, "bun.lock"))).toBe(true);
    }, `${CONFIG}  implode: { restore: [bun.lock] }\n`));

  it("counts a tracked file inside a preRm directory as dirt unless restore would put it back", () =>
    withProject(async ({ list, commit, worktree }) => {
      commit("fe/dist/kept.js", "tracked\n");

      expect((await list()).find((variant) => variant.slug === "demo")?.implodeClean).toBe(false);
      expect(existsSync(join(worktree, "fe", "dist", "kept.js"))).toBe(true);
    }, `${CONFIG}  implode: { requireMerged: false, preRm: [dist] }\n`));

  it("reports main as not clean", () =>
    withProject(async ({ list, repo }) => {
      writeFileSync(join(repo, "variants.local.yaml"), "runtime:\n  slug: main\n");

      expect((await list()).find((variant) => variant.slug === "main")?.implodeClean).toBe(false);
    }));
});
