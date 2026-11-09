import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "./index.js";

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

const until = async (condition: () => boolean): Promise<void> => {
  for (const deadline = Date.now() + 5000; !condition(); await sleep(25)) {
    if (Date.now() > deadline) {
      throw new Error("condition not met in time");
    }
  }
};

/** A variant root `workspace` whose `AGENTS.md` names the checkout `workspace/app`, and no `variants.yaml` in the root. */
const withRoot = async (
  run: (layout: { workspace: string; main: string; marker: string }) => Promise<void>,
): Promise<void> => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-root-api-")));
  const workspace = join(parent, "work");
  const main = join(workspace, "app");
  const marker = join(parent, "marker.txt");
  try {
    mkdirSync(join(main, "be"), { recursive: true });
    execFileSync("git", ["init", "-q", "-b", "main", main]);
    git(main, "config", "user.email", "variant@example.test");
    git(main, "config", "user.name", "Variant Tests");
    writeFileSync(join(main, "AGENTS.md"), "# agents\n");
    writeFileSync(
      join(main, "variants.yaml"),
      [
        "db:",
        "  dialect: sqlite",
        "variant:",
        "  supervise: { startDelaySeconds: 0, checkoutPollSeconds: 0 }",
        "  watches:",
        `    be: { kind: nestjs, dir: be, watch: "echo \${slug} > ${marker}; pwd >> ${marker}" }`,
        "",
      ].join("\n"),
    );
    writeFileSync(join(main, "be", ".gitkeep"), "");
    git(main, "add", ".");
    git(main, "commit", "-q", "-m", "initial");
    symlinkSync(join(main, "AGENTS.md"), join(workspace, "AGENTS.md"));
    await run({ workspace, main, marker });
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

describe("operations from the variant root", () => {
  it("creates a worktree from the variant root", () =>
    withRoot(async ({ workspace }) => {
      const client = createClient({
        cwd: workspace,
        config: loadConfig({ cwd: workspace, env: {} }),
        stateDir: join(workspace, ".state"),
      });

      const record = await client.create("foo");

      expect(record.worktree).toBe(join(workspace, "_v-foo"));
      expect(git(record.worktree as string, "branch", "--show-current")).toBe("feat/foo");
    }));

  it("removes a worktree from the variant root through the main checkout", () =>
    withRoot(async ({ workspace, main }) => {
      const client = createClient({
        cwd: workspace,
        config: loadConfig({ cwd: workspace, env: {} }),
        stateDir: join(workspace, ".state"),
      });
      await client.create("foo");

      const result = await client.implode("foo", { force: true, log: () => {} });

      expect(result.worktreeRemoved).toBe(true);
      expect(git(main, "worktree", "list")).not.toContain("_v-foo");
    }));

  it("errors when the variant root is given no slug and does not inspect git there", () =>
    withRoot(async ({ workspace }) => {
      const bin = join(workspace, "bin");
      const log = join(workspace, "git.log");
      mkdirSync(bin);
      const real = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
      writeFileSync(
        join(bin, "git"),
        `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\nexec ${JSON.stringify(real)} "$@"\n`,
      );
      chmodSync(join(bin, "git"), 0o755);
      const saved = process.env.PATH;
      process.env.PATH = `${bin}:${saved}`;
      try {
        const client = createClient({
          cwd: workspace,
          config: loadConfig({ cwd: workspace, env: {} }),
          stateDir: join(workspace, ".state"),
        });
        const failure = await client.create().catch((error: Error) => error);

        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toContain("pass -s/--slug");
        const traced = existsSync(log) ? readFileSync(log, "utf8") : "";
        expect(traced.split("\n").some((line) => line.split(" ").includes(workspace))).toBe(false);
      } finally {
        process.env.PATH = saved;
      }
    }));

  it("runs watch of main in the main checkout", () =>
    withRoot(async ({ workspace, main, marker }) => {
      const client = createClient({
        cwd: workspace,
        config: loadConfig({ cwd: workspace, env: {} }),
        stateDir: join(workspace, ".state"),
      });

      await client.watch("main", { detach: true, log: () => {} });
      await until(() => {
        try {
          return readFileSync(marker, "utf8").includes("\n");
        } catch {
          return false;
        }
      });

      expect(readFileSync(marker, "utf8")).toBe(`main\n${join(main, "be")}\n`);
    }));

  it("runs watch of a slug in that slug's worktree and prints the slug", () =>
    withRoot(async ({ workspace, marker }) => {
      const client = createClient({
        cwd: workspace,
        config: loadConfig({ cwd: workspace, env: {} }),
        stateDir: join(workspace, ".state"),
      });

      await client.watch("foo", { detach: true, log: () => {} });
      await until(() => {
        try {
          return readFileSync(marker, "utf8").includes("\n");
        } catch {
          return false;
        }
      });

      expect(readFileSync(marker, "utf8")).toBe(`foo\n${join(workspace, "_v-foo", "be")}\n`);
    }));

  it("prints main when an operation starts in the primary checkout", () =>
    withRoot(async ({ main, marker }) => {
      const client = createClient({
        cwd: main,
        config: loadConfig({ cwd: main, env: {} }),
        stateDir: join(main, ".state"),
      });

      await client.watch(undefined, { detach: true, log: () => {} });
      await until(() => {
        try {
          return readFileSync(marker, "utf8").includes("\n");
        } catch {
          return false;
        }
      });

      expect(readFileSync(marker, "utf8")).toBe(`main\n${join(main, "be")}\n`);
    }));

  it("prints the branch slug when an operation starts in that worktree", () =>
    withRoot(async ({ main, marker }) => {
      const origin = createClient({
        cwd: main,
        config: loadConfig({ cwd: main, env: {} }),
        stateDir: join(main, ".state"),
      });
      const worktree = (await origin.create("add-auth")).worktree as string;
      const client = createClient({
        cwd: worktree,
        config: loadConfig({ cwd: worktree, env: {} }),
        stateDir: join(main, ".state"),
      });

      await client.watch(undefined, { detach: true, log: () => {} });
      await until(() => {
        try {
          return readFileSync(marker, "utf8").includes("\n");
        } catch {
          return false;
        }
      });

      expect(readFileSync(marker, "utf8")).toBe(`add-auth\n${join(worktree, "be")}\n`);
    }));

  it("stops a slug from the variant root", () =>
    withRoot(async ({ workspace }) => {
      const client = createClient({
        cwd: workspace,
        config: loadConfig({ cwd: workspace, env: {} }),
        stateDir: join(workspace, ".state"),
      });
      await client.create("foo");

      const result = await client.down("foo");

      expect(result.slug).toBe("foo");
    }));

  it("copies a watch env file into the slug worktree when started from the variant root", () =>
    withRoot(async ({ workspace, main }) => {
      writeFileSync(join(main, "be", ".env.example"), "WHO=old\n");
      writeFileSync(
        join(main, "variants.yaml"),
        [
          "db:",
          "  dialect: sqlite",
          "variant:",
          "  supervise: { startDelaySeconds: 0, checkoutPollSeconds: 0 }",
          "  watches:",
          '    be: { kind: nestjs, dir: be, env: { sourceFile: .env, overrides: { WHO: "${slug}" } }, watch: "echo hi" }',
          "",
        ].join("\n"),
      );
      const client = createClient({
        cwd: workspace,
        config: loadConfig({ cwd: workspace, env: {} }),
        stateDir: join(workspace, ".state"),
      });

      await client.watch("foo", { detach: true, log: () => {} });

      expect(readFileSync(join(workspace, "_v-foo", "be", ".env"), "utf8")).toContain("WHO=foo");
    }));
});
