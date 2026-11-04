/**
 * Drives the generated completion scripts in their real shells against a `variant` stub that records every start, and
 * asserts what a user would see: what is offered, how often `variant` runs, and that nothing is left behind.
 * A shell that is not installed skips its tests.
 */
import { describe, expect, it } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  type Dirent,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { generateCompletions, type Shell } from "../src/completions.js";

const support = `${import.meta.dir}/support/completions`;
const slow = 120_000;

type Transcript = Record<string, string>;

interface Fixture {
  root: string;
  home: string;
  temp: string;
}

interface Outcome {
  t: Transcript;
  left: string[];
}

type Run = (fixture: Fixture, scenario: string, extra?: Record<string, string>) => Promise<Transcript>;

/** A project-like tree: directory `a` lists add-auth and fix-login, `b` lists other-one; a private HOME and TMPDIR. */
const withFixture = async <T>(run: (fixture: Fixture) => Promise<T>): Promise<T> => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "variant-shells-")));
  try {
    for (const directory of ["bin", "home", "tmp", "a", "b"]) {
      mkdirSync(join(root, directory));
    }
    copyFileSync(`${support}/variant-stub`, join(root, "bin", "variant"));
    chmodSync(join(root, "bin", "variant"), 0o755);
    writeFileSync(join(root, "a", "slugs"), "add-auth\nfix-login\n");
    writeFileSync(join(root, "b", "slugs"), "other-one\n");
    writeFileSync(join(root, "log"), "");
    return await run({ root, home: join(root, "home"), temp: join(root, "tmp") });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/**
 * What the completion left in the user's HOME or temporary directory: every file of the temporary directory, and any file
 * of HOME that is named for or mentions the script's variables (a shell creates files of its own there, which are not
 * the script's doing).
 */
const leftBehind = (fixture: Fixture): string[] => {
  const files = (directory: string): string[] =>
    (readdirSync(directory, { recursive: true, withFileTypes: true }) as Dirent[])
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
  const mentions = (file: string): boolean =>
    /variant|slug/i.test(relative(fixture.home, file)) || readFileSync(file, "utf8").includes("__variant");
  return [...files(fixture.temp), ...files(fixture.home).filter(mentions)];
};

/** Runs a driver script in a shell with a bare environment and returns its `key=value` lines. */
const drive = async (
  fixture: Fixture,
  shell: Shell,
  binary: string,
  driver: string,
  args: string[],
  extra: Record<string, string> = {},
): Promise<Transcript> => {
  writeFileSync(join(fixture.root, "script"), generateCompletions(shell));
  const flags = shell === "fish" ? ["--no-config"] : shell === "bash" ? ["--norc", "--noprofile"] : ["-f"];
  const proc = Bun.spawn([binary, ...flags, `${support}/${driver}`, ...args], {
    cwd: fixture.root,
    env: {
      PATH: `${join(fixture.root, "bin")}:/usr/bin:/bin`,
      HOME: fixture.home,
      TMPDIR: fixture.temp,
      TERM: "dumb",
      SCRIPT: join(fixture.root, "script"),
      ROOT: fixture.root,
      STUB_LOG: join(fixture.root, "log"),
      ...extra,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  await proc.exited;
  expect(stderr).toBe("");
  return Object.fromEntries(
    stdout
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
};

/** Runs a scenario in a fresh fixture the first time it is asked for; later asks share the outcome. */
const once = (run: Run, scenario: string, extra?: Record<string, string>): (() => Promise<Outcome>) => {
  let outcome: Promise<Outcome> | undefined;
  return () => {
    outcome ??= withFixture(async (fixture) => {
      const t = await run(fixture, scenario, extra);
      return { t, left: leftBehind(fixture) };
    });
    return outcome;
  };
};

const bashVersion = (binary: string): [number, number] => {
  const script = 'echo "${BASH_VERSINFO[0]} ${BASH_VERSINFO[1]}"';
  const out = Bun.spawnSync([binary, "-c", script]).stdout.toString().trim();
  const [major, minor] = out.split(" ").map(Number);
  return [major ?? 0, minor ?? 0];
};
const canPrefetch = ([major, minor]: [number, number]): boolean => major > 4 || (major === 4 && minor >= 1);

const offered = (shown: string | undefined, ...slugs: string[]): void => {
  for (const slug of slugs) {
    expect(shown).toContain(slug);
  }
};

/** The behavior of a shell that gathers in the background: bash 4.1 or newer and zsh. */
const prefetchingBehavior = (name: string, run: Run, skip: boolean): void => {
  describe(name, () => {
    const warm = once(run, "warm");
    const cold = once(run, "cold");
    const inflight = once(run, "inflight", { STUB_DELAY: "1" });

    it.skipIf(skip)(
      "starts one background gathering on the first completion and answers slugs from memory afterwards",
      async () => {
        const { t } = await warm();

        offered(t.commands, "up", "implode");
        expect(t.calls_after_prefetch).toBe("1");
        offered(t.slugs, "add-auth", "fix-login");
        expect(t.calls_after_slugs).toBe("1");
        offered(t.slugs_again, "add-auth", "fix-login");
        expect(t.calls_after_again).toBe("1");
      },
      slow,
    );

    it.skipIf(skip)(
      "offers an older list at once, gathers again, and serves the new variant on the next completion",
      async () => {
        const { t } = await warm();

        offered(t.slugs_stale, "add-auth", "fix-login");
        expect(t.slugs_stale).not.toContain("new-one");
        expect(t.calls_after_stale).toBe("2");
        offered(t.slugs_after_stale, "new-one");
        expect(t.calls_after_refresh).toBe("2");
      },
      slow,
    );

    it.skipIf(skip)(
      "does not serve the list of one directory in another",
      async () => {
        const { t } = await warm();

        offered(t.slugs_other_dir, "other-one");
        expect(t.slugs_other_dir).not.toContain("add-auth");
        expect(t.calls_after_other_dir).toBe("3");
      },
      slow,
    );

    it.skipIf(skip)(
      "answers the very first slug completion, with exactly one gathering",
      async () => {
        const { t } = await cold();

        offered(t.slugs, "add-auth", "fix-login");
        expect(t.calls).toBe("1");
      },
      slow,
    );

    it.skipIf(skip)(
      "waits for a gathering under way instead of starting a second one",
      async () => {
        const { t } = await inflight();

        offered(t.slugs, "add-auth", "fix-login");
        expect(t.calls).toBe("1");
      },
      slow,
    );

    it.skipIf(skip)(
      "leaves no job notice and no file behind",
      async () => {
        const { t, left } = await warm();

        expect(t.jobs ?? "").toBe("");
        expect(t.commands).not.toMatch(/\[\d+\]\s+\d+/);
        expect(t.slugs).not.toMatch(/\[\d+\]\s+\d+/);
        expect(left).toEqual([]);
      },
      slow,
    );
  });
};

/** The behavior of a shell that gathers on demand: fish and bash older than 4.1. */
const onDemandBehavior = (name: string, run: Run, skip: boolean): void => {
  describe(name, () => {
    const warm = once(run, "warm");

    it.skipIf(skip)(
      "gathers at the first slug completion only, then answers from memory for 30 seconds",
      async () => {
        const { t, left } = await warm();

        expect(t.calls_after_prefetch).toBe("0");
        offered(t.slugs, "add-auth", "fix-login");
        expect(t.calls_after_slugs).toBe("1");
        offered(t.slugs_again, "add-auth", "fix-login");
        expect(t.calls_after_again).toBe("1");
        expect(left).toEqual([]);
      },
      slow,
    );

    it.skipIf(skip)(
      "gathers again when the list is older than 30 seconds and offers the new variant",
      async () => {
        const { t } = await warm();

        offered(t.slugs_stale, "new-one");
        expect(t.calls_after_stale).toBe("2");
      },
      slow,
    );

    it.skipIf(skip)(
      "does not serve the list of one directory in another",
      async () => {
        const { t } = await warm();

        offered(t.slugs_other_dir, "other-one");
        expect(t.slugs_other_dir).not.toContain("add-auth");
        expect(t.calls_after_other_dir).toBe("3");
      },
      slow,
    );
  });
};

const modernBash = Bun.which("bash");
const systemBash = existsSync("/bin/bash") ? "/bin/bash" : undefined;
const modernVersion = modernBash ? bashVersion(modernBash) : ([0, 0] as [number, number]);
const systemVersion = systemBash ? bashVersion(systemBash) : ([0, 0] as [number, number]);

describe("bash completion in a real shell", () => {
  prefetchingBehavior(
    "bash 4.1 or newer",
    (fixture, scenario, extra) =>
      drive(fixture, "bash", modernBash as string, "drive.bash", [scenario], { EXPECT_ASYNC: "1", ...extra }),
    modernBash === undefined || !canPrefetch(modernVersion),
  );
  onDemandBehavior(
    "bash taking the path of versions older than 4.1",
    (fixture, scenario) =>
      drive(fixture, "bash", modernBash as string, "drive.bash", [scenario], { EXPECT_ASYNC: "0", FORCE_SYNC: "1" }),
    modernBash === undefined,
  );
  onDemandBehavior(
    "the system bash when it is older than 4.1 (macOS /bin/bash 3.2)",
    (fixture, scenario) =>
      drive(fixture, "bash", systemBash as string, "drive.bash", [scenario], { EXPECT_ASYNC: "0" }),
    systemBash === undefined || canPrefetch(systemVersion),
  );
});

describe("zsh completion in a real shell", () => {
  const zsh = Bun.which("zsh");
  const run: Run = (fixture, scenario, extra) => drive(fixture, "zsh", zsh as string, "drive.zsh", [scenario], extra);
  prefetchingBehavior("zsh", run, zsh === null);

  it.skipIf(zsh === null)(
    "has the prefetched list in the shell before the next completion, without another keypress",
    async () => {
      const { t } = await once(run, "warm")();

      expect(t.remembered).toContain("add-auth fix-login");
    },
    slow,
  );
});

describe("fish completion in a real shell", () => {
  const fish = Bun.which("fish");
  onDemandBehavior(
    "fish",
    (fixture, scenario) => drive(fixture, "fish", fish as string, "drive.fish", [scenario]),
    fish === null,
  );
});
