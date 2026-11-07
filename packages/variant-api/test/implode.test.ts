import { afterEach, describe, expect, it } from "bun:test";
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";
import { type LogEvent, setLogSink } from "../src/log.js";
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
/** Dark-yellow `+ <command>` the implode report wraps around plain git output. */
const yellowTrace = (command: string): string => `\n\x1b[33m+ ${command}\x1b[0m\n`;

const CONFIG = lines(
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  storage: {}",
  "  watches:",
  "    fe: { kind: vite, dir: fe }",
);

interface Project {
  /** The primary checkout. */
  repo: string;
  /** The worktree of variant `demo`, created before the test body runs. */
  worktree: string;
  client: ReturnType<typeof createClient>;
  messages: string[];
  implode: (options?: { force?: boolean; branchRm?: "yes" | "no" }, slug?: string) => Promise<ImplodeResult>;
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
      writeFileSync(database, "");

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
      const stateDir = join(worktree, ".cache", "variant");
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(join(stateDir, "state.yaml"), `slug: demo\nmode: watch\nwatches:\n  fe: { pid: ${pid} }\n`);
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

      expect(result).toMatchObject({ slug: "orphan", removed: false, worktreeRemoved: false });
      expect(result.worktree).toBeUndefined();
      expect(existsSync(record.target)).toBe(false);
    }));

  it("removes the local branch after the worktree", () =>
    withProject(async ({ implode, repo, worktree }) => {
      const events: LogEvent[] = [];
      setLogSink((event) => events.push(event));
      try {
        const result = await implode();

        expect(existsSync(worktree)).toBe(false);
        expect(git(repo, "branch", "--list", "feat/demo")).toBe("");
        expect(result).toMatchObject({ branch: "feat/demo", branchRemoved: true });
        expect(events).toContainEqual({ level: "debug", message: "removed branch feat/demo" });
      } finally {
        setLogSink(undefined);
      }
    }));

  it("removes the local branch when branchRm is yes", () =>
    withProject(async ({ implode, repo }) => {
      await implode({ branchRm: "yes" });

      expect(git(repo, "branch", "--list", "feat/demo")).toBe("");
    }));

  it("keeps the local branch when branchRm is no", () =>
    withProject(async ({ implode, repo, worktree }) => {
      const events: LogEvent[] = [];
      setLogSink((event) => events.push(event));
      try {
        const result = await implode({ branchRm: "no" });

        expect(existsSync(worktree)).toBe(false);
        expect(git(repo, "branch", "--list", "feat/demo")).toContain("feat/demo");
        expect(result).toMatchObject({ branch: "feat/demo", branchRemoved: false });
        expect(events).toContainEqual({ level: "debug", message: "kept branch feat/demo" });
      } finally {
        setLogSink(undefined);
      }
    }));

  it("keeps the branch when unmerged work is refused", () =>
    withProject(async ({ implode, commit, repo }) => {
      commit("src/b.ts", "export const b = 2;\n");

      await expect(implode()).rejects.toThrow(/force/);
      expect(git(repo, "branch", "--list", "feat/demo")).toContain("feat/demo");
    }));

  it("removes an unmerged branch when force is given", () =>
    withProject(async ({ implode, commit, repo }) => {
      commit("src/b.ts", "export const b = 2;\n");

      await implode({ force: true });

      expect(git(repo, "branch", "--list", "feat/demo")).toBe("");
    }));

  it("removes a leftover branch when the worktree is already gone", () =>
    withProject(async ({ implode, repo, worktree }) => {
      git(repo, "worktree", "remove", worktree);

      const result = await implode();

      expect(result.worktreeRemoved).toBe(false);
      expect(git(repo, "branch", "--list", "feat/demo")).toBe("");
    }));

  it("succeeds when no local branch matches the slug", () =>
    withProject(async ({ repo }) => {
      const events: LogEvent[] = [];
      setLogSink((event) => events.push(event));
      const bare = createClient({
        config: loadConfig({ cwd: repo, env: {} }),
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        worktree: false,
      });
      try {
        await bare.implode("orphan");

        expect(events).toContainEqual({ level: "debug", message: "no branch to remove for orphan" });
      } finally {
        setLogSink(undefined);
      }
    }));

  it("rejects a branchRm other than yes or no before removing anything", () =>
    withProject(async ({ implode, repo, worktree }) => {
      await expect(implode({ branchRm: "true" as "yes" })).rejects.toThrow(/yes, no/);

      expect(existsSync(worktree)).toBe(true);
      expect(git(repo, "branch", "--list", "feat/demo")).toContain("feat/demo");
    }));

  it("leaves the upstream branch in place", () =>
    withProject(async ({ implode, repo, worktree }) => {
      const remote = join(repo, "..", "origin.git");
      execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
      git(repo, "remote", "add", "origin", remote);
      git(worktree, "push", "-q", "-u", "origin", "feat/demo");

      await implode();

      expect(git(repo, "branch", "--list", "feat/demo")).toBe("");
      expect(git(remote, "branch", "--list", "feat/demo")).toContain("feat/demo");
    }));

  it("fails after the worktree is gone when the branch is checked out elsewhere", () =>
    withProject(async ({ implode, repo, worktree }) => {
      const bin = mkdtempSync(join("/tmp", "variant-git-shim-"));
      const real = execFileSync("bash", ["-lc", "command -v git"], { encoding: "utf8" }).trim();
      writeFileSync(
        join(bin, "git"),
        `#!/usr/bin/env bash
real=${JSON.stringify(real)}
if [[ "\${VARIANT_BRANCH_HOLD:-}" == 1 && "$*" == *"worktree remove"* ]]; then
  wt="\${@: -1}"
  branch="$("$real" -C "$wt" rev-parse --abbrev-ref HEAD)"
  primary=""
  args=("$@")
  for ((i=0; i<\${#args[@]}; i++)); do
    if [[ "\${args[$i]}" == "-C" ]]; then primary="\${args[$((i+1))]}"; fi
  done
  "$real" "$@"
  "$real" -C "$primary" checkout -q "$branch"
  exit 0
fi
exec "$real" "$@"
`,
      );
      chmodSync(join(bin, "git"), 0o755);
      const path = process.env.PATH;
      process.env.PATH = `${bin}:${path}`;
      process.env.VARIANT_BRANCH_HOLD = "1";
      try {
        await expect(implode()).rejects.toThrow(/feat\/demo/);
        expect(existsSync(worktree)).toBe(false);
        expect(git(repo, "branch", "--list", "feat/demo")).toContain("feat/demo");
      } finally {
        process.env.PATH = path;
        delete process.env.VARIANT_BRANCH_HOLD;
        rmSync(bin, { recursive: true, force: true });
      }
    }));

  it("reports the removed worktree and removes it last", () =>
    withProject(async ({ implode, worktree }) => {
      const result = await implode();

      expect(result.worktree).toBe(worktree);
      expect(existsSync(worktree)).toBe(false);
    }));
});

describe("implode cleanup", () => {
  it("deletes the preRm matches below every watch directory", () =>
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

  it("deletes the preRm matches in the project directory too", () =>
    withProject(
      async ({ implode, worktree, messages }) => {
        mkdirSync(join(worktree, "dist"));
        writeFileSync(join(worktree, "dist", "out.js"), "x");

        await implode();

        expect(messages.join("\n")).not.toContain("dist/");
      },
      lines("db:", "  dialect: sqlite", "variant:", "  implode: { preRm: [dist] }"),
    ));

  it("keeps a matching directory that contains a tracked file", () =>
    withProject(async ({ implode, commit, worktree, messages }) => {
      commit("fe/dist/keep.txt", "tracked\n");
      writeFileSync(join(worktree, "fe/dist/extra.js"), "untracked\n");
      mkdirSync(join(worktree, "fe/node_modules"));
      writeFileSync(join(worktree, "fe/node_modules/dep.js"), "x");

      await implode({ force: true });

      // the report is taken after the removal: the untracked file in the kept directory is still listed
      expect(messages.join("\n")).toContain("fe/dist/extra.js");
      expect(messages.join("\n")).not.toContain("node_modules");
    }, `${CONFIG}  implode: { preRm: [dist, node_modules] }\n`));

  it("deletes untracked files matching a pattern and keeps tracked ones", () =>
    withProject(async ({ implode, commit, worktree, messages }) => {
      commit("rec/demo/pr2-demo.webm", "tracked\n");
      writeFileSync(join(worktree, "rec/demo/pr2-demo.webm"), "tracked, then modified\n");
      writeFileSync(join(worktree, "rec/demo/pr7-demo.webm"), "untracked\n");

      await implode({ force: true });

      const report = messages.join("\n");
      expect(report).not.toContain("pr7-demo.webm");
      expect(report).toContain(" M rec/demo/pr2-demo.webm");
    }, `${CONFIG}  implode: { preRm: ['rec/\${slug}/pr*-demo.webm'] }\n`));

  it("discards modified lockfiles after the report and leaves other modified files", () =>
    withProject(async ({ implode, worktree, messages }) => {
      writeFileSync(join(worktree, "bun.lock"), "lock v2\n");
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 99;\n");

      await expect(implode()).rejects.toThrow(/modified or untracked files/);

      expect(messages.join("\n")).toContain(" M bun.lock");
      expect(readFileSync(join(worktree, "bun.lock"), "utf8")).toBe("lock v1\n");
      expect(readFileSync(join(worktree, "src/a.ts"), "utf8")).toBe("export const a = 99;\n");
    }, `${CONFIG}  implode: { discard: [bun.lock] }\n`));

  it("removes a worktree whose only changes are discarded lockfiles", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "bun.lock"), "lock v2\n");

      expect((await implode()).worktreeRemoved).toBe(true);
    }, `${CONFIG}  implode: { discard: [bun.lock] }\n`));

  it("removes a worktree with local changes when forced", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 99;\n");

      expect((await implode({ force: true })).worktreeRemoved).toBe(true);
      expect(existsSync(worktree)).toBe(false);
    }));
});

describe("implode report", () => {
  it("traces a one-line edit with porcelain status, a stat and a patch that starts at +++", () =>
    withProject(async ({ implode, worktree, messages }) => {
      git(worktree, "config", "color.ui", "always");
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 2;\n");

      const result = await implode({ force: true });
      const report = result.report as string;
      const status = yellowTrace("git status --porcelain");
      const stat = yellowTrace("git diff --stat");
      const diff = yellowTrace("git diff -U1 src/a.ts");
      const statusAt = report.indexOf(status);
      const statAt = report.indexOf(stat);
      const diffAt = report.indexOf(diff);

      expect(statusAt).toBe(0);
      expect(statAt).toBeGreaterThan(statusAt);
      expect(diffAt).toBeGreaterThan(statAt);
      expect(report.slice(statusAt + status.length, statAt)).toContain(" M src/a.ts");
      expect(report.slice(statAt + stat.length, diffAt)).toContain("1 file changed");
      const patch = report.slice(diffAt + diff.length);
      const [first] = patch.split("\n");
      expect(first).toContain("+++");
      expect(first).toContain("src/a.ts");
      expect(patch).toContain("@@");
      expect(first).not.toContain("\x1b");
      expect(report.slice(statusAt + status.length, statAt)).not.toContain("\x1b");
      expect(report.slice(statAt + stat.length, diffAt)).not.toContain("\x1b");
      expect(report).not.toContain("diff --git");
      expect(report.split("\n").some((line) => /^index [0-9a-f]+\.\.[0-9a-f]+ /.test(line))).toBe(false);
      expect(report.split("\n").some((line) => line.startsWith("--- "))).toBe(false);
      expect(messages).toContain(report);
    }));

  it("colors an added hunk line green and a removed hunk line red, and leaves +++ plain", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 2;\n");

      const report = (await implode({ force: true })).report as string;
      const added = report.split("\n").find((line) => line.includes("export const a = 2"));
      const removed = report.split("\n").find((line) => line.includes("export const a = 1"));
      const header = report.split("\n").find((line) => line.startsWith("+++"));

      expect(added).toBe("\x1b[32m+export const a = 2;\x1b[0m");
      expect(removed).toBe("\x1b[31m-export const a = 1;\x1b[0m");
      expect(header).not.toContain("\x1b");
    }));

  it("traces src/a.ts before src/b.ts and drops both files' headers", () =>
    withProject(async ({ implode, worktree, commit }) => {
      commit("src/b.ts", "export const b = 1;\n");
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 2;\n");
      writeFileSync(join(worktree, "src/b.ts"), "export const b = 2;\n");

      const report = (await implode({ force: true })).report as string;
      const first = report.indexOf("+ git diff -U1 src/a.ts");
      const second = report.indexOf("+ git diff -U1 src/b.ts");

      expect(first).toBeGreaterThanOrEqual(0);
      expect(second).toBeGreaterThan(first);
      const pluses = report.split("\n").filter((line) => line.startsWith("+++"));
      expect(pluses[0]).toContain("src/a.ts");
      expect(pluses[1]).toContain("src/b.ts");
      expect(report).not.toContain("diff --git");
      expect(report.split("\n").some((line) => /^index [0-9a-f]+\.\.[0-9a-f]+ /.test(line))).toBe(false);
      expect(report.split("\n").some((line) => line.startsWith("--- "))).toBe(false);
    }));

  it("keeps porcelain status and the stat and drops every patch when maxDiffLines is 0", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 2;\n");

      const report = (await implode({ force: true })).report as string;

      expect(report).toContain("+ git status --porcelain");
      expect(report).toContain("+ git diff --stat");
      expect(report).toContain(" M src/a.ts");
      expect(report).not.toContain("git diff -U1");
    }, `${CONFIG}  implode: { maxDiffLines: 0 }\n`));

  it("lists an untracked file in porcelain and does not diff it", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "src/new.ts"), "export const n = 1;\n");

      const report = (await implode({ force: true })).report as string;

      expect(report).toContain("?? src/new.ts");
      expect(report).not.toContain("git diff -U1");
    }));

  it("lists a staged-only change in porcelain and does not diff it", () =>
    withProject(async ({ implode, worktree }) => {
      writeFileSync(join(worktree, "src/a.ts"), "export const a = 2;\n");
      git(worktree, "add", "src/a.ts");

      const report = (await implode({ force: true })).report as string;

      expect(report).toContain("M  src/a.ts");
      expect(report).not.toContain("git diff -U1");
    }));

  it("quotes a path that contains a space in its trace", () =>
    withProject(async ({ implode, worktree, commit }) => {
      commit("src/a file.ts", "export const spaced = 1;\n");
      writeFileSync(join(worktree, "src/a file.ts"), "export const spaced = 2;\n");

      const report = (await implode({ force: true })).report as string;

      expect(report).toContain(yellowTrace('git diff -U1 "src/a file.ts"'));
    }));
});
