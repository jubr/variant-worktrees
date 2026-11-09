import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "./index.js";
import { installEngineStub } from "./test/engine-stub.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

/** A repository with one commit on `main`, removed afterwards. */
const withRepo = async (run: (repo: string) => Promise<void>): Promise<void> => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-from-")));
  const repo = join(parent, "repo");
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git(repo, "config", "user.email", "variant@example.test");
    git(repo, "config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "README.md"), "test\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-q", "-m", "initial");
    await run(repo);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

/** A commit on branch `side` that `main` does not contain. Leaves the checkout on `main`. */
const commitSide = (repo: string): string => {
  git(repo, "switch", "-q", "-c", "side");
  writeFileSync(join(repo, "side.txt"), "side\n");
  git(repo, "add", "side.txt");
  git(repo, "commit", "-q", "-m", "side work");
  const side = git(repo, "rev-parse", "HEAD");
  git(repo, "switch", "-q", "main");
  return side;
};

const clientFor = (repo: string) => {
  const config = loadConfig({ cwd: repo, env: {} });
  return createClient({
    config: { ...config, db: { dialect: "sqlite" } },
    cwd: repo,
    stateDir: join(repo, ".cache", "variants"),
  });
};

describe("create from a commit-ish", () => {
  it("starts the new branch at from", async () => {
    await withRepo(async (repo) => {
      const mainTip = git(repo, "rev-parse", "HEAD");
      const side = commitSide(repo);

      const created = await clientFor(repo).create("add-auth", { from: side });

      expect(side).not.toBe(mainTip);
      expect(git(created.worktree as string, "branch", "--show-current")).toBe("feat/add-auth");
      expect(git(created.worktree as string, "rev-parse", "HEAD")).toBe(side);
    });
  });

  it("starts the new branch at from when provisioning", async () => {
    await withRepo(async (repo) => {
      const mainTip = git(repo, "rev-parse", "HEAD");
      const side = commitSide(repo);

      await clientFor(repo).provision("add-auth", { from: side });

      expect(side).not.toBe(mainTip);
      expect(git(join(repo, "_v-add-auth"), "rev-parse", "HEAD")).toBe(side);
    });
  });

  it("starts the new branch at from when bringing the variant up", async () => {
    const originalPath = process.env.PATH;
    try {
      await withRepo(async (repo) => {
        const engine = installEngineStub(repo);
        process.env.PATH = `${engine.bin}${originalPath ? `:${originalPath}` : ""}`;
        const mainTip = git(repo, "rev-parse", "HEAD");
        const side = commitSide(repo);

        await clientFor(repo).up("add-auth", { from: side, opener: () => {}, log: () => {} });

        expect(side).not.toBe(mainTip);
        expect(git(join(repo, "_v-add-auth"), "rev-parse", "HEAD")).toBe(side);
      });
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("starts the new branch at from when watching", async () => {
    await withRepo(async (repo) => {
      const mainTip = git(repo, "rev-parse", "HEAD");
      const side = commitSide(repo);

      await clientFor(repo).watch("add-auth", { from: side, detach: true, log: () => {} });

      expect(side).not.toBe(mainTip);
      expect(git(join(repo, "_v-add-auth"), "rev-parse", "HEAD")).toBe(side);
    });
  });

  it("does not move an existing worktree when a later call names another from", async () => {
    await withRepo(async (repo) => {
      const client = clientFor(repo);
      const side = commitSide(repo);
      const mainTip = git(repo, "rev-parse", "HEAD");
      const created = await client.create("add-auth", { from: side });

      await client.create("add-auth", { from: mainTip });

      expect(mainTip).not.toBe(side);
      expect(git(created.worktree as string, "rev-parse", "HEAD")).toBe(side);
    });
  });

  it("refuses to implode a branch started off the base branch without force", async () => {
    await withRepo(async (repo) => {
      const client = clientFor(repo);
      const side = commitSide(repo);
      await client.create("add-auth", { from: side });

      await expect(client.implode("add-auth", { log: () => {} })).rejects.toThrow(/not merged into main/);
      expect(git(join(repo, "_v-add-auth"), "rev-parse", "HEAD")).toBe(side);
    });
  });
});
