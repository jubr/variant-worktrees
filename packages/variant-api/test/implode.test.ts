import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";
import { isProcessAlive } from "../src/runtime-state.js";
import type { ImplodeResult } from "../src/types.js";

const spawned: ChildProcess[] = [];
afterEach(() => {
  for (const child of spawned.splice(0)) {
    try {
      process.kill(-(child.pid as number), "SIGKILL");
    } catch {
      // already gone
    }
  }
});

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
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
  /** The primary checkout. */
  repo: string;
  /** The worktree of variant `demo`, created before the test body runs. */
  worktree: string;
  client: ReturnType<typeof createClient>;
  messages: string[];
  implode: (options?: { force?: boolean }, slug?: string) => Promise<ImplodeResult>;
  /** Commits a file in the variant's worktree. */
  commit: (path: string, content: string) => void;
  database: string;
}

const withProject = async (
  run: (project: Project) => Promise<void>,
  yaml: string = CONFIG,
  extraFiles: Record<string, string> = {},
): Promise<void> => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-implode-git-")));
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
      ...extraFiles,
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
    const record = await client.create("demo");
    const worktree = record.worktree as string;
    const messages: string[] = [];
    await run({
      repo,
      worktree,
      client,
      messages,
      implode: (options = {}, slug = "demo") =>
        client.implode(slug, { ...options, log: (line) => messages.push(line) }),
      commit: (path, content) => {
        mkdirSync(join(worktree, path, ".."), { recursive: true });
        writeFileSync(join(worktree, path), content);
        git(worktree, "add", path);
        git(worktree, "commit", "-q", "-m", `change ${path}`);
      },
      database: record.target,
    });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

describe("implode merge gate", () => {
  it("refuses main and the primary checkout", () =>
    withProject(async ({ implode, repo }) => {
      await expect(implode({}, "main")).rejects.toThrow("primary checkout");
      expect(existsSync(repo)).toBe(true);
    }));

  it("refuses unmerged work, names force and changes nothing", () =>
    withProject(async ({ implode, commit, worktree, database }) => {
      commit("src/b.ts", "export const b = 2;\n");
      writeFileSync(join(worktree, "variants.local.yaml"), "runtime:\n  slug: demo\n");

      await expect(implode()).rejects.toThrow(/force/);

      expect(existsSync(worktree)).toBe(true);
      expect(existsSync(database)).toBe(true);
      expect(readFileSync(join(worktree, "variants.local.yaml"), "utf8")).toContain("slug: demo");
    }));

  it("accepts a variant that is merged into the base branch", () =>
    withProject(async ({ implode, worktree }) => {
      const result = await implode();

      expect(result).toMatchObject({ slug: "demo", worktreeRemoved: true, worktree });
      expect(existsSync(worktree)).toBe(false);
    }));

  it("accepts work that only the remote base branch holds", () =>
    withProject(async ({ implode, commit, repo, worktree }) => {
      const remote = join(repo, "..", "origin.git");
      execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
      git(repo, "remote", "add", "origin", remote);
      git(repo, "push", "-q", "origin", "main");
      commit("src/b.ts", "export const b = 2;\n");
      git(worktree, "push", "-q", "origin", "HEAD:main");

      expect(git(repo, "branch", "--contains", git(worktree, "rev-parse", "HEAD"), "main")).toBe("");
      const result = await implode();

      expect(result.worktreeRemoved).toBe(true);
    }));

  it("falls back to the local base branch when there is no remote", () =>
    withProject(async ({ implode, commit, repo }) => {
      commit("src/b.ts", "export const b = 2;\n");
      git(repo, "merge", "-q", "--ff-only", "feat/demo");

      expect((await implode()).worktreeRemoved).toBe(true);
    }));

  it("implodes unmerged work when requireMerged is false", () =>
    withProject(async ({ implode, commit }) => {
      commit("src/b.ts", "export const b = 2;\n");

      expect((await implode()).worktreeRemoved).toBe(true);
    }, `${CONFIG}  implode: { requireMerged: false }\n`));

  it("implodes unmerged work when forced", () =>
    withProject(async ({ implode, commit }) => {
      commit("src/b.ts", "export const b = 2;\n");

      expect((await implode({ force: true })).worktreeRemoved).toBe(true);
    }));

  it("uses variant.baseBranch for the gate", () =>
    withProject(async ({ commit, repo }) => {
      git(repo, "branch", "develop");
      commit("src/b.ts", "export const b = 2;\n");
      git(repo, "merge", "-q", "--ff-only", "feat/demo");
      const config = loadConfig({ cwd: repo, env: {} });
      const against = (baseBranch: string) =>
        createClient({
          config: { ...config, variant: { ...config.variant, baseBranch } },
          cwd: repo,
          stateDir: join(repo, ".cache", "variants"),
        });

      await expect(against("develop").implode("demo", { log: () => {} })).rejects.toThrow("develop");
      expect((await against("main").implode("demo", { log: () => {} })).worktreeRemoved).toBe(true);
    }));
});

describe("implode teardown and worktree", () => {
  it("stops a running watch and drops the database before the worktree goes", () =>
    withProject(async ({ implode, worktree, database }) => {
      const watcher = spawn("sleep", ["300"], { cwd: join(worktree, "fe"), detached: true, stdio: "ignore" });
      spawned.push(watcher);
      const pid = watcher.pid as number;
      writeFileSync(
        join(worktree, "variants.local.yaml"),
        `runtime:\n  slug: demo\n  mode: watch\n  instances:\n    fe: { pid: ${pid} }\n`,
      );
      await sleep(50);

      await implode();

      for (let attempt = 0; attempt < 100 && isProcessAlive(pid); attempt += 1) {
        await sleep(50);
      }
      expect(isProcessAlive(pid)).toBe(false);
      expect(existsSync(database)).toBe(false);
      expect(existsSync(worktree)).toBe(false);
    }));

  it("finishes after the teardown for a variant without a worktree", () =>
    withProject(async ({ implode, repo }) => {
      const bare = createClient({
        config: loadConfig({ cwd: repo, env: {} }),
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        worktree: false,
      });
      const record = await bare.create("orphan");

      const result = await implode({}, "orphan");

      expect(result).toMatchObject({ slug: "orphan", removed: true, worktreeRemoved: false });
      expect(result.worktree).toBeUndefined();
      expect(existsSync(record.target)).toBe(false);
    }));

  it("keeps the git branch", () =>
    withProject(async ({ implode, repo }) => {
      await implode();

      expect(git(repo, "branch", "--list", "feat/demo")).toContain("feat/demo");
    }));

  it("reports the removed worktree and removes it last", () =>
    withProject(async ({ implode, worktree }) => {
      const result = await implode();

      expect(result.worktree).toBe(worktree);
      expect(existsSync(worktree)).toBe(false);
    }));
});

describe("implode cleanup", () => {
  it("deletes the preRm directories below every instance directory", () =>
    withProject(async ({ implode, worktree, messages }) => {
      mkdirSync(join(worktree, "fe", "dist"));
      writeFileSync(join(worktree, "fe", "dist", "out.js"), "x");
      mkdirSync(join(worktree, "fe", "node_modules"));
      writeFileSync(join(worktree, "fe", "node_modules", "dep.js"), "x");

      // an untracked directory would make `git worktree remove` fail, so a success proves the removal
      await implode();

      expect(messages.join("\n")).not.toContain("fe/dist");
      expect(messages.join("\n")).not.toContain("node_modules");
    }, `${CONFIG}  implode: { preRm: [dist, node_modules] }\n`));

  it("deletes the preRm directories in the root when there are no instances", () =>
    withProject(
      async ({ implode, worktree, messages }) => {
        mkdirSync(join(worktree, "dist"));
        writeFileSync(join(worktree, "dist", "out.js"), "x");

        await implode();

        expect(messages.join("\n")).not.toContain("dist/");
      },
      lines("db:", "  dialect: sqlite", "variant:", "  implode: { preRm: [dist] }"),
    ));

  it("deletes untracked files matching a pattern and keeps tracked ones", () =>
    withProject(async ({ implode, commit, worktree, messages }) => {
      commit("rec/demo/pr2-demo.webm", "tracked\n");
      writeFileSync(join(worktree, "rec/demo/pr2-demo.webm"), "tracked, then modified\n");
      writeFileSync(join(worktree, "rec/demo/pr7-demo.webm"), "untracked\n");

      await implode({ force: true });

      const report = messages.join("\n");
      expect(report).not.toContain("pr7-demo.webm");
      expect(report).toContain("modified:   rec/demo/pr2-demo.webm");
    }, `${CONFIG}  implode: { untracked: ['rec/{{slug}}/pr*-demo.webm'] }\n`));

  it("discards modified lockfiles after the report and leaves other modified files", () =>
    withProject(async ({ implode, worktree, messages }) => {
      writeFileSync(join(worktree, "bun.lock"), "lock v2\n");
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 99;\n");

      await expect(implode()).rejects.toThrow(/modified or untracked files/);

      expect(messages.join("\n")).toContain("modified:   bun.lock");
      expect(readFileSync(join(worktree, "bun.lock"), "utf8")).toBe("lock v1\n");
      expect(readFileSync(join(worktree, "src/a.ts"), "utf8")).toBe("export const a = 99;\n");
    }, `${CONFIG}  implode: { restore: [bun.lock] }\n`));

  it("removes a worktree whose only changes are discarded lockfiles", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "bun.lock"), "lock v2\n");

      expect((await implode()).worktreeRemoved).toBe(true);
    }, `${CONFIG}  implode: { restore: [bun.lock] }\n`));

  it("removes a worktree with local changes when forced", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 99;\n");

      expect((await implode({ force: true })).worktreeRemoved).toBe(true);
      expect(existsSync(worktree)).toBe(false);
    }));
});

describe("implode report", () => {
  const edit = (worktree: string, count: number): void =>
    writeFileSync(
      join(worktree, "src/a.ts"),
      Array.from({ length: count }, (_, line) => `export const v${line} = ${line};`).join("\n"),
    );

  it("contains status, stat and the full diff when it is short", () =>
    withProject(async ({ implode, worktree, messages }) => {
      edit(worktree, 5);

      const result = await implode({ force: true });

      expect(result.report).toContain("modified:   src/a.ts");
      expect(result.report).toContain("1 file changed");
      expect(result.report).toContain("diff --git");
      expect(messages).toContain(result.report as string);
    }));

  it("leaves out the full diff when it exceeds maxDiffLines", () =>
    withProject(async ({ implode, worktree }) => {
      edit(worktree, 500);

      const result = await implode({ force: true });

      expect(result.report).toContain("modified:   src/a.ts");
      expect(result.report).toContain("1 file changed");
      expect(result.report).not.toContain("diff --git");
    }, `${CONFIG}  implode: { maxDiffLines: 200 }\n`));
});
