import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createVariantClient } from "./index.js";
import { warnWhenBunDiffers } from "./mise-bun.js";
import { fakeMise } from "./test/mise-mock.js";

// AIDEV-NOTE: each stub executable is new, and the first run of a new file can take over a second on macOS.
setDefaultTimeout(30_000);

/** A directory holding an executable `bun` that prints `version` and leaves a marker file when it runs. */
const stubBun = (root: string, name: string, version: string, exitCode = 0): string => {
  const directory = join(root, name);
  mkdirSync(directory, { recursive: true });
  const bun = join(directory, "bun");
  writeFileSync(bun, `#!/bin/sh\ntouch "${join(directory, "ran")}"\necho ${version}\nexit ${exitCode}\n`);
  chmodSync(bun, 0o755);
  return directory;
};

const pinned = (version: string, path: string): string =>
  JSON.stringify([{ version, requested_version: version, install_path: path, active: true }]);

const withRoot = async (run: (root: string) => Promise<void> | void): Promise<void> => {
  const root = realpathSync(mkdtempSync(join("/tmp", "variant-mise-bun-")));
  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const check = (root: string, miseOptions: Parameters<typeof fakeMise>[1], path: string, withMise = true): string[] => {
  const log: string[] = [];
  warnWhenBunDiffers({
    directory: root,
    binary: withMise ? fakeMise(root, miseOptions).binary : undefined,
    env: { PATH: path },
    log: (line) => log.push(line),
  });
  return log;
};

describe("warnWhenBunDiffers", () => {
  it("warns once with both versions and paths and the directory that comes first on PATH", () =>
    withRoot((root) => {
      const foreign = stubBun(root, "foreign", "1.3.0");
      const mise = stubBun(root, "mise-bun", "1.4.2");

      const log = check(
        root,
        { lsCurrent: pinned("1.4.2", join(root, "mise-bun")), which: join(mise, "bun") },
        `${foreign}:${mise}`,
      );

      expect(log).toHaveLength(1);
      expect(log[0]).toStartWith("Warning:");
      for (const part of ["1.4.2", join(mise, "bun"), "1.3.0", join(foreign, "bun"), foreign]) {
        expect(log[0]).toContain(part);
      }
    }));

  it("stays silent when the Bun on PATH has the pinned version", () =>
    withRoot((root) => {
      const mise = stubBun(root, "mise-bun", "1.4.2");

      expect(check(root, { lsCurrent: pinned("1.4.2", mise), which: join(mise, "bun") }, mise)).toEqual([]);
    }));

  it("stays silent for the same version behind another path", () =>
    withRoot((root) => {
      const mise = stubBun(root, "mise-bun", "1.4.2");
      const link = join(root, "link");
      mkdirSync(link);
      symlinkSync(join(mise, "bun"), join(link, "bun"));

      expect(check(root, { lsCurrent: pinned("1.4.2", mise), which: join(mise, "bun") }, `${link}:${mise}`)).toEqual(
        [],
      );
    }));

  it("stays silent and runs no Bun when Mise pins none", () =>
    withRoot((root) => {
      const foreign = stubBun(root, "foreign", "1.3.0");

      expect(check(root, { lsCurrent: "[]" }, foreign)).toEqual([]);
      expect(existsSync(join(foreign, "ran"))).toBe(false);
    }));

  it("stays silent without a Mise executable", () =>
    withRoot((root) => {
      const foreign = stubBun(root, "foreign", "1.3.0");

      expect(check(root, {}, foreign, false)).toEqual([]);
      expect(existsSync(join(foreign, "ran"))).toBe(false);
    }));

  it("stays silent when no bun is on PATH", () =>
    withRoot((root) => {
      mkdirSync(join(root, "empty"));

      expect(check(root, { lsCurrent: pinned("1.4.2", root) }, join(root, "empty"))).toEqual([]);
    }));

  it("stays silent when the Bun on PATH fails its version probe", () =>
    withRoot((root) => {
      const broken = stubBun(root, "broken", "1.3.0", 1);

      expect(check(root, { lsCurrent: pinned("1.4.2", root) }, broken)).toEqual([]);
    }));
});

describe("provision with another Bun first on PATH", () => {
  const savedPath = process.env.PATH;
  afterEach(() => {
    process.env.PATH = savedPath;
  });

  it("warns once for a project with two watches and still provisions", () =>
    withRoot(async (root) => {
      const foreign = stubBun(root, "foreign", "1.3.0");
      const mise = stubBun(root, "mise-bun", "1.4.2");
      const fake = fakeMise(root, { lsCurrent: pinned("1.4.2", mise), which: join(mise, "bun") });
      for (const dir of ["fe", "be"]) {
        mkdirSync(join(root, dir));
      }
      writeFileSync(
        join(root, "variants.yaml"),
        "db:\n  dialect: sqlite\nvariant:\n  open: false\n  watches:\n    fe: { kind: vite, dir: fe }\n    be: { kind: nestjs, dir: be }\n  seed: touch seeded\n",
      );
      process.env.PATH = `${foreign}:${mise}:${savedPath}`;
      const client = createVariantClient({
        config: loadConfig({ cwd: root, env: {} }),
        cwd: root,
        stateDir: join(root, ".cache", "variants"),
        worktree: false,
        miseBinPath: fake.binary,
      });
      const log: string[] = [];

      await client.provision("demo", { log: (line) => log.push(line) });

      expect(log.filter((line) => line.startsWith("Warning: bun"))).toHaveLength(1);
      expect(existsSync(join(root, "seeded"))).toBe(true);
    }));

  it("runs no Mise process and warns of nothing when the operation is given miseInstall no", () =>
    withRoot(async (root) => {
      const foreign = stubBun(root, "foreign", "1.3.0");
      const mise = stubBun(root, "mise-bun", "1.4.2");
      const fake = fakeMise(root, { lsCurrent: pinned("1.4.2", mise), which: join(mise, "bun") });
      writeFileSync(join(root, "variants.yaml"), "db:\n  dialect: sqlite\nvariant:\n  open: false\n");
      process.env.PATH = `${foreign}:${mise}:${savedPath}`;
      const client = createVariantClient({
        config: loadConfig({ cwd: root, env: {} }),
        cwd: root,
        stateDir: join(root, ".cache", "variants"),
        worktree: false,
        miseBinPath: fake.binary,
      });
      const log: string[] = [];

      await client.provision("demo", { miseInstall: "no", log: (line) => log.push(line) });

      expect(fake.calls()).toEqual([]);
      expect(log.filter((line) => line.startsWith("Warning: bun"))).toEqual([]);
    }));
});
