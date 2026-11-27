import { afterEach, describe, expect, it, setDefaultTimeout } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Writable } from "node:stream";
import { loadConfig } from "variant-config";
import { isProcessAlive } from "./runtime-state.js";
import {
  launchWatches,
  type RelayPlan,
  relayModulePath,
  relayStderrMode,
  type WatchOutputMode,
} from "./watch-relay.js";

setDefaultTimeout(30000);
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    cleanup();
  }
});

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const until = async (condition: () => boolean, ms = 15000): Promise<void> => {
  for (const deadline = Date.now() + ms; !condition(); await sleep(25)) {
    if (Date.now() > deadline) {
      throw new Error("condition not met in time");
    }
  }
};

const VARIANTS = "db:\n  type: sqlite\nvariant:\n  watches:\n    fe: { kind: vite, dir: fe }\n";

interface Relay {
  project: string;
  worktree: string;
  /** The state file of `demo`, below the project and not below the worktree. */
  stateFile: string;
  /** Standard error of the relay. */
  stderr: () => string;
  pids: Record<string, number>;
  exited: () => boolean;
  /** Files under `directory`, relative, or none when it does not exist. */
  below: (directory: string) => string[];
}

interface Options {
  command?: string;
  slug?: string;
  pollSeconds?: number;
  cleanup?: boolean;
}

/** Starts the relay module with a plan for one watch in a worktree that stands below a project directory. */
const withRelay = async (options: Options, body: (relay: Relay) => Promise<void>): Promise<void> => {
  const project = realpathSync(mkdtempSync(join("/tmp", "variant-relay-")));
  const slug = options.slug ?? "demo";
  const worktree = join(project, `_v-${slug}`);
  const stateDir = join(project, ".cache", "variants");
  const stateFile = join(stateDir, `${slug}.yaml`);
  const errorFile = join(project, "relay.err");
  const children: ChildProcess[] = [];
  cleanups.push(() => {
    for (const child of children) {
      try {
        process.kill(-(child.pid as number), "SIGKILL");
      } catch {
        // already gone
      }
    }
    rmSync(project, { recursive: true, force: true });
  });
  mkdirSync(join(worktree, "fe"), { recursive: true });
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(project, "variants.yaml"), VARIANTS);
  writeFileSync(stateFile, `slug: ${slug}\n`);
  const config = loadConfig({ cwd: project, env: {} });
  const plan: RelayPlan = {
    launches: [
      {
        key: "fe",
        command: (options.command ?? "sleep 300").replaceAll("$WT", worktree),
        cwd: join(worktree, "fe"),
        env: { ...process.env, VARIANT_OPEN: "0" },
      },
    ],
    startDelayMs: 0,
    logPath: join(worktree, ".cache", "variant", "watch.log"),
    ...(options.cleanup === false
      ? {}
      : {
          cleanup: {
            slug,
            worktree,
            cwd: project,
            stateDir,
            config,
            useWorktree: true,
            pollSeconds: options.pollSeconds ?? 1,
          },
        }),
  };
  const relay = spawn(process.execPath, [relayModulePath()], {
    detached: true,
    stdio: ["pipe", "pipe", openSync(errorFile, "w")],
    env: { ...process.env, VARIANT_OPEN: "0" },
  });
  children.push(relay);
  let ended = false;
  relay.on("exit", () => {
    ended = true;
  });
  let stdout = "";
  relay.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  relay.stdin?.end(JSON.stringify(plan));
  await until(() => stdout.includes("\n"));
  const pids = (JSON.parse(stdout.split("\n")[0] as string) as { pids: Record<string, number> }).pids;
  children.push(...Object.values(pids).map((pid) => ({ pid }) as ChildProcess));
  const below = (directory: string): string[] => {
    if (!existsSync(directory)) {
      return [];
    }
    const found: string[] = [];
    const walk = (path: string, prefix: string): void => {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const name = join(prefix, entry.name);
        found.push(name);
        if (entry.isDirectory()) {
          walk(join(path, entry.name), name);
        }
      }
    };
    walk(directory, "");
    return found;
  };
  await body({
    project,
    worktree,
    stateFile,
    stderr: () => readFileSync(errorFile, "utf8"),
    pids,
    exited: () => ended,
    below,
  });
};

describe("a detached watch relay follows its worktree", () => {
  it("stops the processes, implodes the variant and ends when the worktree is removed", () =>
    withRelay({}, async ({ worktree, pids, stateFile, exited }) => {
      const fe = pids.fe as number;
      expect(isProcessAlive(fe)).toBe(true);

      rmSync(worktree, { recursive: true, force: true });
      await until(() => exited());

      expect(isProcessAlive(fe)).toBe(false);
      expect(existsSync(stateFile)).toBe(false);
      expect(existsSync(worktree)).toBe(false);
    }));

  it("writes the warnings to its standard error, each before its action", () =>
    withRelay({}, async ({ worktree, pids, stderr, exited }) => {
      rmSync(worktree, { recursive: true, force: true });
      await until(() => exited());

      const lines = stderr().split("\n");
      const found = (text: string): number => lines.findIndex((line) => line.includes(text));
      expect(lines.some((line) => line.startsWith("[warn] ") || line.startsWith("[trace] "))).toBe(true);
      expect(found(worktree)).toBeGreaterThanOrEqual(0);
      expect(found(`stopping watch fe pid ${pids.fe}`)).toBeGreaterThan(found(worktree));
      expect(found("removing state file")).toBeGreaterThan(found(`stopping watch fe pid ${pids.fe}`));
    }));

  it("writes nothing below the worktree path while a process still prints", () =>
    withRelay(
      { command: `trap 'echo bye; echo bye >&2; sleep 0.3; echo late' TERM; echo hi; while true; do sleep 0.1; done` },
      async ({ worktree, pids, exited, below }) => {
        rmSync(worktree, { recursive: true, force: true });
        await until(() => exited());

        expect(isProcessAlive(pids.fe as number)).toBe(false);
        expect(below(worktree)).toEqual([]);
        expect(existsSync(worktree)).toBe(false);
      },
    ));

  it("counts a directory that a process recreates as gone and writes no file into it", () =>
    withRelay(
      { command: `while true; do mkdir -p "$WT/.cache/scratch"; sleep 0.1; done` },
      async ({ worktree, pids, exited, below }) => {
        rmSync(worktree, { recursive: true, force: true });
        await until(() => exited());

        expect(isProcessAlive(pids.fe as number)).toBe(false);
        const created = below(worktree).filter((path) => !path.startsWith(".cache"));
        expect(created).toEqual([]);
        expect(below(worktree)).not.toContain(join(".cache", "variant", "watch.log"));
        expect(below(worktree)).not.toContain(join(".cache", "variant", "in.sock"));
      },
    ));

  it("only stops the processes of main and leaves the state alone", () =>
    withRelay({ slug: "main" }, async ({ worktree, pids, stateFile, exited }) => {
      rmSync(worktree, { recursive: true, force: true });
      await until(() => exited());

      expect(isProcessAlive(pids.fe as number)).toBe(false);
      expect(existsSync(stateFile)).toBe(true);
    }));

  it("keeps running when the check is off", () =>
    withRelay({ pollSeconds: 0 }, async ({ worktree, pids, exited }) => {
      rmSync(worktree, { recursive: true, force: true });
      await sleep(2500);

      expect(exited()).toBe(false);
      expect(isProcessAlive(pids.fe as number)).toBe(true);
    }));

  it("keeps running when the worktree stays", () =>
    withRelay({}, async ({ pids, stateFile, exited }) => {
      await sleep(2500);

      expect(exited()).toBe(false);
      expect(isProcessAlive(pids.fe as number)).toBe(true);
      expect(existsSync(stateFile)).toBe(true);
    }));

  it("behaves as before for a plan without cleanup", () =>
    withRelay({ cleanup: false }, async ({ worktree, pids, exited }) => {
      rmSync(worktree, { recursive: true, force: true });
      await sleep(2500);

      expect(exited()).toBe(false);
      expect(isProcessAlive(pids.fe as number)).toBe(true);
    }));
});

describe("the standard error of a detached relay", () => {
  const kind = (file: boolean, character: boolean) => ({ isFile: () => file, isCharacterDevice: () => character });

  it("is the caller's when that is a file or a terminal", () => {
    expect(relayStderrMode(kind(true, false))).toBe("inherit");
    expect(relayStderrMode(kind(false, true))).toBe("inherit");
  });

  it("is closed when the caller's is a pipe or unknown, so a reader of that pipe is not held", () => {
    expect(relayStderrMode(kind(false, false))).toBe("ignore");
    expect(relayStderrMode(undefined)).toBe("ignore");
  });
});

/** Runs `command` as watch `fe` and returns what the console and the log received. */
const relayed = async (
  command: string,
  outputMode: WatchOutputMode = "no-tty",
): Promise<{ out: string; log: string }> => {
  const directory = mkdtempSync(join("/tmp", "variant-clear-"));
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
  const chunks: string[] = [];
  const stdout = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const logPath = join(directory, "watch.log");
  const launched = await launchWatches({
    launches: [{ key: "fe", command, cwd: directory, env: process.env, outputMode }],
    startDelayMs: 0,
    stdout,
    stderr: stdout,
    logPath,
  });
  await Promise.all(
    launched.processes.map(
      ({ child }) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null) resolve();
          else child.once("exit", () => resolve());
        }),
    ),
  );
  await launched.close();
  return { out: chunks.join(""), log: readFileSync(logPath, "utf8") };
};

describe("watch output has no clear-screen sequences", () => {
  const ESC = "\u001b";

  it.each([
    ["erase display", "\\033[2J"],
    ["erase scrollback", "\\033[3J"],
    ["erase to end", "\\033[J"],
    ["erase to start", "\\033[1J"],
    ["cursor home", "\\033[H"],
    ["cursor home with a semicolon", "\\033[;H"],
    ["cursor home with a position", "\\033[1;1H"],
    ["terminal reset", "\\033c"],
    ["all of the vite sequences", "\\033[2J\\033[3J\\033[H"],
  ])("removes %s before a message and keeps the message", async (_name, sequence) => {
    const { out, log } = await relayed(`printf '${sequence}rebuilt\\n'`);

    expect(out).toBe("[fe] rebuilt\n");
    expect(log).toContain("[fe] rebuilt\n");
    expect(log).not.toContain(ESC);
  });

  it("skips a line that only held clear sequences and keeps a line the process wrote empty", async () => {
    const { out, log } = await relayed(`printf 'a\\n\\n\\033[H\\033[2J\\nb\\n'`);

    expect(out).toBe("[fe] a\n[fe] \n[fe] b\n");
    expect(log).toContain("[fe] a\n[fe] \n[fe] b\n");
  });

  it("keeps other escape sequences", async () => {
    const { out } = await relayed(`printf '\\033[2Kline\\n'`);

    expect(out).toBe(`[fe] ${ESC}[2Kline\n`);
  });

  it("removes a sequence that arrives in two chunks", async () => {
    const { out } = await relayed(`printf '\\033[2'; sleep 0.3; printf 'Jtext\\n'`);

    expect(out).toBe("[fe] text\n");
  });

  it("keeps color and its reset on a terminal while removing the clear", async () => {
    const { out, log } = await relayed(`printf '\\033[2J\\033[32mready\\033[0m\\n'`, "tty");

    expect(out).toBe(`[fe] ${ESC}[32mready${ESC}[0m${ESC}[0m\n`);
    expect(log).toContain(`[fe] ${ESC}[32mready${ESC}[0m${ESC}[0m\n`);
    expect(log).not.toContain(`${ESC}[2J`);
  });

  it("appends no reset to a terminal line whose only escapes were removed", async () => {
    const { out, log } = await relayed(`printf '\\033[2J\\033[Hrebuilt\\n'`, "tty");

    expect(out).toBe("[fe] rebuilt\n");
    expect(log).toContain("[fe] rebuilt\n");
    expect(log).not.toContain(ESC);
  });
});
