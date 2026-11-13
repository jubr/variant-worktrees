/**
 * Specification: openspec/specs/variant-cli/working-directory/spec.md
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schemaHeaderFor } from "variant-config";
import { runCommand } from "./test/cli.js";

const cli = join(import.meta.dir, "cli.ts");

const yaml = (body: string): string => `${schemaHeaderFor("variants.yaml")}\n\n${body}`;

const run = (args: string[], cwd: string) => runCommand(["bun", "run", cli], args, { VARIANT_CONFIG: "" }, cwd);

const scratch = (name: string): string => realpathSync(mkdtempSync(join(tmpdir(), `variant-chdir-${name}-`)));

const writeConfig = (directory: string, prefix: string): void => {
  writeFileSync(join(directory, "variants.yaml"), yaml(`variant:\n  prefix: ${prefix}\n`));
};

describe("directory option", () => {
  it("reads configuration from the directory named before the command", async () => {
    const start = scratch("start");
    const project = scratch("project");
    try {
      writeConfig(start, "startprefix-");
      writeConfig(project, "projprefix-");

      const result = await run(["-C", project, "config"], start);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("prefix: projprefix-");
      expect(result.stdout).not.toContain("prefix: startprefix-");
    } finally {
      rmSync(start, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("reads configuration from the directory named after the command", async () => {
    const start = scratch("start");
    const project = scratch("project");
    try {
      writeConfig(start, "startprefix-");
      writeConfig(project, "projprefix-");

      const result = await run(["config", "-C", project], start);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("prefix: projprefix-");
      expect(result.stdout).not.toContain("prefix: startprefix-");
    } finally {
      rmSync(start, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("reads configuration from a path written in the same argument", async () => {
    const start = scratch("start");
    const project = scratch("project");
    try {
      writeConfig(start, "startprefix-");
      writeConfig(project, "projprefix-");

      const result = await run([`-C${project}`, "config"], start);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("prefix: projprefix-");
      expect(result.stdout).not.toContain("prefix: startprefix-");
    } finally {
      rmSync(start, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("resolves a relative path from the starting directory", async () => {
    const parent = scratch("parent");
    const child = join(parent, "child");
    try {
      mkdirSync(child);
      writeConfig(parent, "startprefix-");
      writeConfig(child, "projprefix-");

      const result = await run(["-C", "child", "config"], parent);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("prefix: projprefix-");
      expect(result.stdout).not.toContain("prefix: startprefix-");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("applies repeated options from left to right", async () => {
    const start = scratch("start");
    const parent = scratch("parent");
    const child = join(parent, "child");
    try {
      mkdirSync(child);
      writeConfig(start, "startprefix-");
      writeConfig(child, "projprefix-");

      const result = await run(["-C", parent, "-C", "child", "config"], start);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("prefix: projprefix-");
      expect(result.stdout).not.toContain("prefix: startprefix-");
    } finally {
      rmSync(start, { recursive: true, force: true });
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("keeps --log-level when -C is also set", async () => {
    const start = scratch("start");
    const project = scratch("project");
    try {
      writeConfig(start, "startprefix-");
      writeConfig(project, "projprefix-");

      const result = await run(["-C", project, "--log-level=error", "config"], start);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("prefix: projprefix-");
    } finally {
      rmSync(start, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });

  it("fails when -C has no path and does not run the command", async () => {
    const start = scratch("start");
    try {
      writeConfig(start, "startprefix-");

      const result = await run(["-C"], start);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("-C");
      expect(result.stdout).not.toContain("prefix: startprefix-");
    } finally {
      rmSync(start, { recursive: true, force: true });
    }
  });

  it("fails before reading configuration when the path is not a directory", async () => {
    const start = scratch("start");
    const absent = join(start, "missing");
    try {
      writeFileSync(join(start, "variants.yaml"), yaml("db:\n  dialect: not-a-dialect\n"));

      const result = await run(["-C", absent, "config"], start);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("-C");
      expect(result.stderr).toContain(absent);
      expect(result.stderr).not.toContain("Invalid option");
    } finally {
      rmSync(start, { recursive: true, force: true });
    }
  });

  it("does not treat --chdir as the directory option", async () => {
    const start = scratch("start");
    const project = scratch("project");
    try {
      writeConfig(start, "startprefix-");
      writeConfig(project, "projprefix-");

      const result = await run(["--chdir", project, "config"], start);

      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).not.toContain("prefix: projprefix-");
    } finally {
      rmSync(start, { recursive: true, force: true });
      rmSync(project, { recursive: true, force: true });
    }
  });
});
