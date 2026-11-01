import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

type Client = ReturnType<typeof createClient>;

const withProject = async (
  run: (project: {
    directory: string;
    put: (path: string, content: string) => void;
    client: (cwd?: string) => Client;
  }) => Promise<void>,
  env: NodeJS.ProcessEnv = {},
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-status-")));
  const put = (path: string, content: string): void => {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  try {
    put(
      "variants.yaml",
      "db:\n  dialect: sqlite\nvariant:\n  instances:\n    fe: { kind: vite, dir: fe }\n    be: { kind: nestjs, dir: be }\n",
    );
    const client = (cwd = directory): Client =>
      createClient({
        config: loadConfig({ cwd: directory, env }),
        cwd,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
    await run({ directory, put, client });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const runtimeFile = (...lines: string[]): string => `runtime:\n${lines.map((line) => `  ${line}`).join("\n")}\n`;

describe("client.status", () => {
  it("returns the record of one variant with its runtime facts", () =>
    withProject(async ({ put, client, directory }) => {
      put(
        "_v-demo/variants.local.yaml",
        runtimeFile(
          "slug: demo",
          "mode: watch",
          "instances:",
          "  fe: { port: 62060, url: 'http://demo.vw.localhost:62060/' }",
        ),
      );

      const status = await client().status("demo");

      expect(status).toMatchObject({
        slug: "demo",
        worktree: join(directory, "_v-demo"),
        mode: "watch",
        url: "http://demo.vw.localhost:62060/",
        instances: { fe: { port: 62060 } },
      });
    }));

  it("describes only the variant that was asked for", () =>
    withProject(async ({ put, client }) => {
      put("_v-alpha/variants.local.yaml", runtimeFile("slug: alpha", "mode: up"));
      put("_v-beta/variants.local.yaml", runtimeFile("slug: beta", "mode: watch"));

      const status = await client().status("alpha");

      expect(Array.isArray(status)).toBe(false);
      expect(status.slug).toBe("alpha");
      expect(status.mode).toBe("up");
    }));

  it("fails naming the slug when nothing is known about it", () =>
    withProject(async ({ client }) => {
      await expect(client().status("ghost")).rejects.toThrow("Unknown variant: ghost");
    }));

  it("knows a variant that has only a database target", () =>
    withProject(async ({ put, client, directory }) => {
      put(".cache/variants/orphan.db", "");

      const status = await client().status("orphan");

      expect(status.target).toBe(join(directory, ".cache", "variants", "orphan.db"));
      expect(status.mode).toBeUndefined();
    }));

  it("takes the slug from the worktree it runs in when none is given", () =>
    withProject(async ({ client, directory }) => {
      const repo = join(directory, "repo");
      const git = (...args: string[]): void => void execFileSync("git", ["-C", repo, ...args], { stdio: "ignore" });
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      git("config", "user.email", "variant@example.test");
      git("config", "user.name", "Variant Tests");
      writeFileSync(join(repo, "README.md"), "x\n");
      git("add", "README.md");
      git("commit", "-q", "-m", "initial");
      git("worktree", "add", "-q", "-b", "feat/demo", join(directory, "_v-demo"));
      writeFileSync(join(directory, "_v-demo", "variants.local.yaml"), runtimeFile("slug: demo", "mode: watch"));

      const status = await client(join(directory, "_v-demo")).status();

      expect(status.slug).toBe("demo");
    }));
});
