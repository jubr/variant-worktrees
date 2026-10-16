import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const lines = (...entries: string[]): string => `${entries.join("\n")}\n`;

const CONFIG = lines(
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  open: false",
  "  seed: pwd > seed.cwd",
  "  supervise: { startDelaySeconds: 0, readyTimeoutSeconds: 1 }",
  "  instances:",
  "    be:",
  "      kind: nestjs",
  "      dir: be",
  "      up: pwd > up.cwd",
  "      watch: pwd > watch.cwd",
  "  steps:",
  "    - { name: in-be, run: pwd > step.cwd, dir: be }",
);

interface Repository {
  /** The git checkout (the primary worktree). */
  root: string;
  /** The directory of `variants.yaml`: the checkout itself or `app` below it. */
  project: string;
}

/** A git repository with one commit whose `variants.yaml` is in the root or in `app/`. */
const withRepository = async (
  layout: "root" | "app",
  run: (repository: Repository) => Promise<void>,
): Promise<void> => {
  const root = realpathSync(mkdtempSync(join("/tmp", "variant-project-")));
  try {
    const project = layout === "app" ? join(root, "app") : root;
    mkdirSync(join(project, "be"), { recursive: true });
    writeFileSync(join(project, "variants.yaml"), CONFIG);
    writeFileSync(join(project, "be", ".keep"), "");
    git(root, "init", "-q", "-b", "main");
    git(root, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
    git(root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init");
    await run({ root, project });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/** A client that works from `cwd` with the configuration found in `project`. */
const clientFor = (project: string, cwd: string, worktree: boolean) =>
  createClient({
    config: loadConfig({ cwd: project, env: {} }),
    cwd,
    stateDir: join(project, ".cache", "variants"),
    worktree,
  });

const read = (path: string): string => readFileSync(path, "utf8").trim();

const untilFile = async (path: string): Promise<boolean> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(path)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
};

describe("project directory", () => {
  it("runs the commands of a configuration in a subdirectory in that subdirectory", () =>
    withRepository("app", async ({ root, project }) => {
      await clientFor(project, project, false).provision("demo", { log: () => {} });

      expect(read(join(project, "seed.cwd"))).toBe(project);
      expect(read(join(project, "be", "up.cwd"))).toBe(join(project, "be"));
      expect(read(join(project, "be", "step.cwd"))).toBe(join(project, "be"));
      expect(existsSync(join(root, "seed.cwd"))).toBe(false);
    }));

  it("gives the same result from a deeper directory of the project", () =>
    withRepository("app", async ({ project }) => {
      await clientFor(project, join(project, "be"), false).provision("demo", { log: () => {} });

      expect(read(join(project, "seed.cwd"))).toBe(project);
      expect(existsSync(join(project, "be", "seed.cwd"))).toBe(false);
    }));

  it("gives main the same project directory", () =>
    withRepository("app", async ({ project }) => {
      await clientFor(project, project, true).provision("main", { log: () => {} });

      expect(read(join(project, "seed.cwd"))).toBe(project);
      expect(read(join(project, "be", "up.cwd"))).toBe(join(project, "be"));
    }));

  it("keeps a configuration in the checkout root in the worktree root", () =>
    withRepository("root", async ({ root }) => {
      await clientFor(root, root, false).provision("demo", { log: () => {} });

      expect(read(join(root, "seed.cwd"))).toBe(root);
      expect(read(join(root, "be", "step.cwd"))).toBe(join(root, "be"));
    }));

  it("re-bases the project directory onto the worktree of a variant", () =>
    withRepository("app", async ({ root, project }) => {
      git(root, "branch", "demo");
      const result = await clientFor(project, project, true).provision("demo", { log: () => {} });

      const worktree = git(root, "worktree", "list", "--porcelain")
        .split("\n")
        .filter((line) => line.startsWith("worktree "))
        .map((line) => realpathSync(line.slice("worktree ".length)))
        .find((path) => path !== root) as string;
      expect(result.slug).toBe("demo");
      expect(read(join(worktree, "app", "seed.cwd"))).toBe(join(worktree, "app"));
      expect(read(join(worktree, "app", "be", "up.cwd"))).toBe(join(worktree, "app", "be"));
      expect(existsSync(join(project, "seed.cwd"))).toBe(false);
    }));

  it("starts watch commands in the instance directory below the project directory", () =>
    withRepository("app", async ({ project }) => {
      await clientFor(project, project, false).watch("demo", { detach: true, log: () => {} });

      expect(await untilFile(join(project, "be", "watch.cwd"))).toBe(true);
      expect(read(join(project, "be", "watch.cwd"))).toBe(join(project, "be"));
    }));
});
