import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "./index.js";
import { type LogEvent, setLogSink } from "./log.js";
import { installMiseBackground } from "./mise-install.js";
import { installEngineStub } from "./test/engine-stub.js";

/** Specification: openspec/specs/variant-api/core/spec.md */

const readIncludes = (path: string, text: string): boolean =>
  existsSync(path) && readFileSync(path, "utf8").includes(text);

const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).trim();

const initRepo = (repo: string): void => {
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  git(repo, "config", "user.email", "variant@example.test");
  git(repo, "config", "user.name", "Variant Tests");
  writeFileSync(join(repo, "README.md"), "test\n");
  git(repo, "add", "README.md");
  git(repo, "commit", "-q", "-m", "initial");
};

/** A stub Mise. Each invocation appends its arguments to `calls`. */
const stubMise = (directory: string, body: string): { binary: string; calls: () => string[] } => {
  const log = join(directory, "mise-calls");
  writeFileSync(log, "");
  const binary = join(directory, "mise");
  writeFileSync(binary, `#!/bin/sh\necho "$*" >> "${log}"\n${body}\n`);
  chmodSync(binary, 0o755);
  return {
    binary,
    calls: () =>
      execFileSync("cat", [log], { encoding: "utf8" })
        .split("\n")
        .filter((line) => line !== ""),
  };
};

const captureStderr = async (run: () => Promise<void>): Promise<string> => {
  const chunks: string[] = [];
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  try {
    await run();
  } finally {
    process.stderr.write = write;
  }
  return chunks.join("");
};

describe("create installs Mise tools", () => {
  it("runs trust and then install before a sync create returns", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-install-")));
    const repo = join(parent, "repo");
    const cwd = process.cwd();
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(
        parent,
        'case "$3" in trust) echo MISE_TRUST >&2;; install) echo MISE_INSTALL >&2;; esac\nexit 0',
      );
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      let worktree = "";
      const stderr = await captureStderr(async () => {
        worktree = (await client.create("add-auth", { miseInstall: "sync" })).worktree ?? "";
      });

      expect(process.cwd()).toBe(cwd);
      const calls = mise.calls();
      expect(calls[0]).toContain("trust --all");
      expect(calls[0]).toContain(worktree);
      expect(calls[1]).toContain("install");
      expect(calls[1]).toContain(worktree);
      expect(stderr.indexOf("MISE_TRUST")).toBeGreaterThan(-1);
      expect(stderr.indexOf("MISE_TRUST")).toBeLessThan(stderr.indexOf("MISE_INSTALL"));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("logs each mise command at trace under /tmp, quoted, with step create and the slug", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-log-")));
    const repo = join(parent, "repo");
    const events: LogEvent[] = [];
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });
      setLogSink((event) => events.push(event));

      await client.create("add-auth", { miseInstall: "sync" });

      expect(events.filter((event) => event.message.startsWith("+"))).toEqual([
        { level: "trace", message: '+"mise trust --all"', step: "create", slug: "add-auth" },
        { level: "trace", message: '+"mise install"', step: "create", slug: "add-auth" },
      ]);
      expect(events.some((event) => event.message.includes("cmd="))).toBe(false);
    } finally {
      setLogSink(undefined);
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("returns from an omitted create while install is still running", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-bg-")));
    const repo = join(parent, "repo");
    const marker = join(parent, "finished");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, `case "$3" in install) sleep 0.3; echo done > "${marker}";; esac\nexit 0`);
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.create("add-auth");

      expect(existsSync(marker)).toBe(false);
      const deadline = Date.now() + 3000;
      while (!existsSync(marker) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(existsSync(marker)).toBe(true);
      const calls = mise.calls();
      expect(calls[0]).toContain("trust --all");
      expect(calls[1]).toContain("install");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("runs trust and install from provision when asked to sync", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-provision-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.provision("add-auth", { miseInstall: "sync" });

      const calls = mise.calls();
      expect(calls[0]).toContain("trust --all");
      expect(calls[1]).toContain("install");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("fails a sync create when trust exits non-zero and skips install", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-trust-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, 'case "$3" in trust) echo TRUST_BROKE >&2; exit 1;; esac\nexit 0');
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      const stderr = await captureStderr(async () => {
        await expect(client.create("add-auth", { miseInstall: "sync" })).rejects.toThrow("TRUST_BROKE");
      });

      expect(stderr).toContain("TRUST_BROKE");
      expect(mise.calls().some((line) => line.includes("install"))).toBe(false);
      expect(existsSync(join(repo, "_v-add-auth"))).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("fails a sync create when install exits non-zero and leaves the worktree", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-install-fail-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, 'case "$3" in install) echo INSTALL_BROKE >&2; exit 1;; esac\nexit 0');
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await expect(client.create("add-auth", { miseInstall: "sync" })).rejects.toThrow("INSTALL_BROKE");
      expect(existsSync(join(repo, "_v-add-auth"))).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("does not run Mise when miseInstall is no", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-no-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.create("add-auth", { miseInstall: "no" });

      expect(mise.calls()).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("skips an omitted create when the worktree has no Mise config", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-absent-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(parent, "mise.toml"), "[tools]\n");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.create("add-auth");

      expect(mise.calls()).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("installs again in a worktree that already exists", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-again-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.create("add-auth", { miseInstall: "no" });
      await client.create("add-auth", { miseInstall: "sync" });

      expect(mise.calls()[0]).toContain("trust --all");
      expect(mise.calls()[1]).toContain("install");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("does not install for main", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-main-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.create("main", { miseInstall: "sync" });

      expect(mise.calls()).toEqual([]);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("fails when the worktree has a Mise config and no executable, and leaves the worktree", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-missing-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: {
          ...baseConfig,
          db: { dialect: "sqlite" },
          variant: { ...baseConfig.variant, mise: { binPath: join(parent, "missing-mise") } },
        },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
      });

      await expect(client.create("add-auth", { miseInstall: "bg" })).rejects.toThrow(/Mise was not found/);
      await expect(client.create("add-auth", { miseInstall: "bg" })).rejects.toThrow("variant.mise.binPath");
      expect(existsSync(join(repo, "_v-add-auth"))).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("rejects an invalid mode before creating a worktree", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-invalid-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
      });

      await expect(client.create("add-auth", { miseInstall: "later" as "bg" })).rejects.toThrow(/bg, sync, or no/);
      expect(existsSync(join(repo, "_v-add-auth"))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("does not install when up creates a worktree", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-up-")));
    const repo = join(parent, "repo");
    const engine = installEngineStub(parent);
    const previousPath = process.env.PATH;
    process.env.PATH = `${engine.bin}${previousPath ? `:${previousPath}` : ""}`;
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.up("add-auth");

      expect(mise.calls()).toEqual([]);
    } finally {
      process.env.PATH = previousPath;
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("runs trust and install from watch when asked to sync", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-watch-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, "exit 0");
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      await client.watch("add-auth", { miseInstall: "sync", detach: true });

      expect(mise.calls()[0]).toContain("trust --all");
      expect(mise.calls()[1]).toContain("install");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("keeps a background create successful when trust fails and records that output", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-bg-trust-")));
    const repo = join(parent, "repo");
    const marker = join(parent, "installed");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(
        parent,
        `case "$3" in trust) echo TRUST_BROKE;; install) echo ran > "${marker}";; esac\nexit 1`,
      );
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });

      const created = await client.create("add-auth", { miseInstall: "bg" });
      const deadline = Date.now() + 3000;
      const log = join(created.worktree ?? "", ".cache", "variant", "mise-install.log");
      while (Date.now() < deadline && !(existsSync(log) && readIncludes(log, "TRUST_BROKE"))) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(existsSync(marker)).toBe(false);
      expect(readIncludes(log, "TRUST_BROKE")).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("replaces the background log and names it on stderr", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-log-")));
    const repo = join(parent, "repo");
    try {
      initRepo(repo);
      writeFileSync(join(repo, "mise.toml"), "[tools]\n");
      git(repo, "add", "mise.toml");
      git(repo, "commit", "-q", "-m", "mise");
      const mise = stubMise(parent, 'case "$3" in install) echo THIS_RUN;; esac\nexit 0');
      const baseConfig = loadConfig({ cwd: repo, env: {} });
      const client = createClient({
        config: { ...baseConfig, db: { dialect: "sqlite" } },
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        miseBinPath: mise.binary,
      });
      const created = await client.create("add-auth", { miseInstall: "no" });
      const log = join(created.worktree ?? "", ".cache", "variant", "mise-install.log");
      execFileSync("mkdir", ["-p", join(created.worktree ?? "", ".cache", "variant")]);
      writeFileSync(log, "OLD_RUN\n");

      const stderr = await captureStderr(async () => {
        await client.create("add-auth", { miseInstall: "bg" });
      });
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline && !readIncludes(log, "THIS_RUN")) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(stderr).toContain("background");
      expect(stderr).toContain(log);
      expect(readIncludes(log, "THIS_RUN")).toBe(true);
      expect(readIncludes(log, "OLD_RUN")).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("fails when the background process cannot be started and leaves the directory", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-mise-spawn-")));
    const directory = join(parent, "worktree");
    try {
      writeFileSync(directory, "");
      rmSync(directory);
      execFileSync("mkdir", [directory]);
      writeFileSync(join(directory, "mise.toml"), "[tools]\n");
      const mise = stubMise(parent, "exit 0");

      await expect(installMiseBackground(mise.binary, directory, join(parent, "missing-runtime"))).rejects.toThrow(
        /could not be started/,
      );
      expect(existsSync(directory)).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
