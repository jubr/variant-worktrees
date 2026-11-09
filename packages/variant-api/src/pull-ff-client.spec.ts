import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "./index.js";
import { installEngineStub } from "./test/engine-stub.js";

const git = (cwd: string, ...args: string[]): string => {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const failed = error as { stderr?: string };
    throw new Error((failed.stderr ?? "").trim() || String(error));
  }
};

const withOrigin = async (run: (repo: string, origin: string) => Promise<void>): Promise<void> => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-pull-ff-client-")));
  const origin = join(parent, "origin.git");
  const repo = join(parent, "repo");
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git(repo, "config", "user.email", "variant@example.test");
    git(repo, "config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "README.md"), "test\n");
    git(repo, "add", "README.md");
    git(repo, "commit", "-q", "-m", "initial");
    execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
    git(repo, "remote", "add", "origin", origin);
    git(repo, "push", "-q", "-u", "origin", "main");
    await run(repo, origin);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

const pushAhead = (origin: string): void => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-pull-ff-client-ahead-")));
  const clone = join(parent, "ahead");
  try {
    execFileSync("git", ["clone", "-q", origin, clone]);
    git(clone, "config", "user.email", "variant@example.test");
    git(clone, "config", "user.name", "Variant Tests");
    const file = `ahead-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`;
    writeFileSync(join(clone, file), "remote\n");
    git(clone, "add", file);
    git(clone, "commit", "-q", "-m", "ahead");
    git(clone, "push", "-q", "origin", "main");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

const clientFor = (repo: string) => {
  const config = loadConfig({ cwd: repo, env: {} });
  return createClient({
    config: { ...config, db: { dialect: "sqlite" } },
    cwd: repo,
    stateDir: join(repo, ".cache", "variants"),
  });
};

describe("pullFf through the client", () => {
  it("fast-forwards main when create asks for it", async () => {
    await withOrigin(async (repo, origin) => {
      pushAhead(origin);

      const created = await clientFor(repo).create("add-auth", { pullFf: true });

      expect(git(repo, "rev-parse", "HEAD")).toBe(git(origin, "rev-parse", "main"));
      expect(git(created.worktree as string, "rev-parse", "HEAD")).toBe(git(repo, "rev-parse", "HEAD"));
    });
  });

  it("fast-forwards main when provision, up, or watch asks for it", async () => {
    const originalPath = process.env.PATH;
    try {
      await withOrigin(async (repo, origin) => {
        const engine = installEngineStub(repo);
        process.env.PATH = `${engine.bin}${originalPath ? `:${originalPath}` : ""}`;
        const client = clientFor(repo);
        pushAhead(origin);
        await client.provision("provisioned", { pullFf: true });
        const provisioned = git(repo, "rev-parse", "HEAD");
        expect(provisioned).toBe(git(origin, "rev-parse", "main"));
        expect(git(join(repo, "_v-provisioned"), "rev-parse", "HEAD")).toBe(provisioned);

        pushAhead(origin);
        await client.up("brought-up", { pullFf: true, opener: () => {}, log: () => {} });
        const broughtUp = git(repo, "rev-parse", "HEAD");
        expect(broughtUp).toBe(git(origin, "rev-parse", "main"));
        expect(git(join(repo, "_v-brought-up"), "rev-parse", "HEAD")).toBe(broughtUp);

        pushAhead(origin);
        await client.watch("watched", { pullFf: true, detach: true, log: () => {} });
        const watched = git(repo, "rev-parse", "HEAD");
        expect(watched).toBe(git(origin, "rev-parse", "main"));
        expect(git(join(repo, "_v-watched"), "rev-parse", "HEAD")).toBe(watched);
      });
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("does not move an existing worktree on a second pullFf", async () => {
    await withOrigin(async (repo, origin) => {
      const client = clientFor(repo);
      const created = await client.create("add-auth", { pullFf: true });
      const head = git(created.worktree as string, "rev-parse", "HEAD");
      pushAhead(origin);

      await client.create("add-auth", { pullFf: true });

      expect(git(created.worktree as string, "rev-parse", "HEAD")).toBe(head);
      expect(git(repo, "rev-parse", "HEAD")).toBe(head);
    });
  });

  it("names the watch command and its flags when the fast-forward fails", async () => {
    await withOrigin(async (repo) => {
      git(repo, "switch", "-q", "-c", "feat/other");

      await expect(
        clientFor(repo).watch("demo", {
          pullFf: true,
          from: "feat/other",
          detach: true,
          reprovision: true,
          log: () => {},
        }),
      ).rejects.toThrow("variant watch --pull-ff --from feat/other --detach --reprovision --slug demo");
    });
  });
});
