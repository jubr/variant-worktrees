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

const check = (
  root: string,
  miseOptions: Parameters<typeof fakeMise>[1],
  path: string,
  withMise = true,
  home = join(root, "home"),
  extraEnv: NodeJS.ProcessEnv = {},
): string[] => {
  const log: string[] = [];
  warnWhenBunDiffers({
    directory: root,
    binary: withMise ? fakeMise(root, miseOptions).binary : undefined,
    env: { PATH: path, ...extraEnv },
    home,
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

describe("the hint of the warning", () => {
  const warn = (
    root: string,
    foreignName: string,
    home = join(root, "home"),
    extraEnv: NodeJS.ProcessEnv = {},
  ): string => {
    const foreign = stubBun(root, foreignName, "1.3.0");
    const mise = stubBun(root, "mise-bun", "1.4.2");
    const [warning] = check(
      root,
      { lsCurrent: pinned("1.4.2", mise), which: join(mise, "bun") },
      `${foreign}:${mise}`,
      true,
      home,
      extraEnv,
    );
    return warning ?? "";
  };

  it("names the installer command and the startup file line that adds the directory", () =>
    withRoot((root) => {
      mkdirSync(join(root, "home"), { recursive: true });
      writeFileSync(
        join(root, "home", ".zshrc"),
        `${"# prompt\n".repeat(11)}export PATH="${join(root, "home", ".bun", "bin")}:$PATH"\n`,
      );

      const warning = warn(root, "home/.bun/bin");

      expect(warning).toContain("rm -rf ~/.bun");
      expect(warning).toContain(`~/.zshrc:12: export PATH="${join(root, "home", ".bun", "bin")}:$PATH"`);
      expect(warning).toContain("which -a bun");
    }));

  it("finds the directory spelled with $HOME and with ~", () =>
    withRoot((root) => {
      mkdirSync(join(root, "home"), { recursive: true });
      writeFileSync(
        join(root, "home", ".bashrc"),
        'export PATH="$HOME/.bun/bin:$PATH"\nPATH=~/.bun/bin:$PATH\nPATH=${HOME}/.bun/bin:$PATH\n',
      );

      const warning = warn(root, "home/.bun/bin");

      expect(warning).toContain('~/.bashrc:1: export PATH="$HOME/.bun/bin:$PATH"');
      expect(warning).toContain("~/.bashrc:2: PATH=~/.bun/bin:$PATH");
      expect(warning).toContain("~/.bashrc:3: PATH=${HOME}/.bun/bin:$PATH");
    }));

  it("leaves out a commented line and says what was searched when nothing is left", () =>
    withRoot((root) => {
      mkdirSync(join(root, "home"), { recursive: true });
      writeFileSync(join(root, "home", ".zshrc"), `  # export PATH="${join(root, "home", ".bun", "bin")}:$PATH"\n`);

      const warning = warn(root, "home/.bun/bin");

      expect(warning).not.toContain(".zshrc:1:");
      expect(warning).toContain("No line");
      expect(warning).toContain("~/.zshrc");
      expect(warning).toContain("~/.config/fish/config.fish");
    }));

  it("advises brew uninstall for a Homebrew prefix", () =>
    withRoot((root) => {
      expect(warn(root, "homebrew/bin")).toContain("brew uninstall bun");
    }));

  it("advises npm uninstall for a node_modules directory", () =>
    withRoot((root) => {
      expect(warn(root, "lib/node_modules/bun/bin")).toContain("npm uninstall -g bun");
    }));

  describe("for another version installed by Mise", () => {
    const notForMise = (warning: string): void => {
      expect(warning).not.toContain("delete /");
      expect(warning).not.toContain("uninstall the package");
      expect(warning).not.toContain("Remove that Bun");
      expect(warning).not.toContain("rm -rf");
      expect(warning).not.toContain("a tool or another file your shell reads");
    };

    it("says it is a Mise install not to delete, inherited from another Mise environment, and to start again clean", () =>
      withRoot((root) => {
        const warning = warn(root, "opt/mise/installs/bun/1.3.0/bin");

        expect(warning).toContain("installed by Mise");
        expect(warning).toContain("do not delete it");
        expect(warning).toContain("inherited");
        expect(warning).toContain("another project");
        expect(warning).toContain("start the editor or terminal again from a shell without it");
        expect(warning).toContain("No startup file adds it");
        expect(warning).toContain("which -a bun");
        notForMise(warning);
      }));

    it("recognizes the installs directory of MISE_DATA_DIR", () =>
      withRoot((root) => {
        const data = join(root, "data");
        const warning = warn(root, "data/installs/bun/1.3.0/bin", join(root, "home"), { MISE_DATA_DIR: data });

        expect(warning).toContain("installed by Mise");
        notForMise(warning);
      }));

    it("still names a startup line that mentions the directory", () =>
      withRoot((root) => {
        mkdirSync(join(root, "home"), { recursive: true });
        writeFileSync(
          join(root, "home", ".zshrc"),
          `export PATH="${join(root, "opt", "mise", "installs", "bun", "1.3.0", "bin")}:$PATH"\n`,
        );

        const warning = warn(root, "opt/mise/installs/bun/1.3.0/bin");

        expect(warning).toContain("~/.zshrc:1: export PATH=");
        expect(warning).toContain("installed by Mise");
      }));

    it("leaves a path outside the installs directory with the delete advice", () =>
      withRoot((root) => {
        expect(warn(root, "opt/mise/shims")).toContain("delete /");
      }));
  });

  it("advises deleting the executable otherwise", () =>
    withRoot((root) => {
      expect(warn(root, "opt/tools/bin")).toContain(`delete ${join(root, "opt/tools/bin/bun")}`);
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
        "db:\n  dialect: sqlite\nvariant:\n  open: false\n  watches:\n    fe: { kind: vite, dir: fe }\n    be: { kind: nestjs, dir: be }\n  steps:\n    seed: { cmd: touch seeded }\n",
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
