import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";

const saved: Record<string, string | undefined> = {};
const setEnv = (name: string, value: string | undefined): void => {
  if (!(name in saved)) {
    saved[name] = process.env[name];
  }
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
};
afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
    delete saved[name];
  }
});

const lines = (...entries: string[]): string => `${entries.join("\n")}\n`;

/** A project directory (not a git repository) with a variants.yaml built from its path. */
const withProject = async (
  yaml: (directory: string) => string,
  run: (
    directory: string,
    provision: (verbose?: boolean) => Promise<{ commands: string[]; output: string }>,
  ) => Promise<void> | void,
  files: Record<string, string> = {},
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-provisioning-")));
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(directory, path, ".."), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    writeFileSync(join(directory, "variants.yaml"), yaml(directory));
    const client = createClient({
      config: loadConfig({ cwd: directory, env: process.env }),
      cwd: directory,
      stateDir: join(directory, ".cache", "variants"),
      worktree: false,
    });
    await run(directory, (verbose) => client.provision("demo", { verbose }));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const read = (directory: string, path: string): string => readFileSync(join(directory, path), "utf8");
const parseEnv = (text: string): Record<string, string> =>
  Object.fromEntries(
    text
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );

describe("provisioning order", () => {
  it("runs the up commands, the steps in order, then the seed command", () =>
    withProject(
      (d) =>
        lines(
          "db:",
          "  dialect: sqlite",
          "variant:",
          `  seed: echo seed >> ${d}/order.log`,
          "  instances:",
          `    fe: { kind: vite, dir: fe, up: "echo up >> ${d}/order.log" }`,
          "  steps:",
          `    - { name: one, run: "echo one >> ${d}/order.log" }`,
          `    - { name: two, run: "echo two >> ${d}/order.log" }`,
        ),
      async (directory, provision) => {
        await provision();

        expect(read(directory, "order.log")).toBe("up\none\ntwo\nseed\n");
      },
      { "fe/.keep": "" },
    ));

  it("stops at the first failing step and names it with its status", () =>
    withProject(
      (d) =>
        lines(
          "db:",
          "  dialect: sqlite",
          "variant:",
          `  seed: echo seed >> ${d}/order.log`,
          "  steps:",
          '    - { name: first, run: "echo boom; exit 3" }',
          `    - { name: second, run: "echo second >> ${d}/order.log" }`,
        ),
      async (directory, provision) => {
        const failure = await provision().catch((error: Error) => error);

        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toContain("first");
        expect((failure as Error).message).toContain("3");
        expect((failure as Error).message).toContain("boom");
        expect(existsSync(join(directory, "order.log"))).toBe(false);
      },
    ));

  it("runs a step in its dir below the worktree", () =>
    withProject(
      () =>
        lines(
          "db:",
          "  dialect: sqlite",
          "variant:",
          "  steps:",
          '    - { name: here, run: "pwd > pwd.out", dir: server }',
        ),
      async (directory, provision) => {
        await provision();

        expect(read(directory, "server/pwd.out").trim()).toBe(join(directory, "server"));
      },
      { "server/.keep": "" },
    ));
});

describe("conditional and quiet steps", () => {
  const yaml = (d: string) =>
    lines(
      "db:",
      "  dialect: sqlite",
      "variant:",
      "  steps:",
      `    - { name: demo-user, run: "echo ran > ${d}/ran.out", unlessEnv: { SEED_DEMO_USER: "false" } }`,
    );

  it("skips a step whose unlessEnv matches and says so", () => {
    setEnv("SEED_DEMO_USER", "false");
    return withProject(yaml, async (directory, provision) => {
      const { output } = await provision();

      expect(existsSync(join(directory, "ran.out"))).toBe(false);
      expect(output).toContain("demo-user");
      expect(output.toLowerCase()).toContain("skip");
    });
  });

  it("runs the step when the variable differs or is unset", () => {
    setEnv("SEED_DEMO_USER", undefined);
    return withProject(yaml, async (directory, provision) => {
      await provision();

      expect(read(directory, "ran.out").trim()).toBe("ran");
    });
  });

  const noisy = lines(
    "db:",
    "  dialect: sqlite",
    "variant:",
    "  steps:",
    "    - name: migrations",
    '      run: "echo query-noise; echo Migration Init applied"',
    '      show: "^Migration "',
  );

  it("prints only the lines that match show", () =>
    withProject(
      () => noisy,
      async (_directory, provision) => {
        const { output } = await provision();

        expect(output).toContain("Migration Init applied");
        expect(output).not.toContain("query-noise");
      },
    ));

  it("prints everything when verbose", () =>
    withProject(
      () => noisy,
      async (_directory, provision) => {
        const { output } = await provision(true);

        expect(output).toContain("query-noise");
        expect(output).toContain("Migration Init applied");
      },
    ));

  it("includes the full output in the error when the step fails", () =>
    withProject(
      () => noisy.replace("echo Migration Init applied", "echo Migration Init applied; exit 1"),
      async (_directory, provision) => {
        const failure = await provision().catch((error: Error) => error);

        expect((failure as Error).message).toContain("query-noise");
      },
    ));
});

describe("instance install", () => {
  const yaml = (d: string) =>
    lines(
      "db:",
      "  dialect: sqlite",
      "variant:",
      "  instances:",
      `    fe: { kind: vite, dir: fe, install: "echo installed >> ${d}/install.log" }`,
    );

  it("runs without node_modules", () =>
    withProject(
      yaml,
      async (directory, provision) => {
        await provision();

        expect(read(directory, "install.log")).toBe("installed\n");
      },
      { "fe/.keep": "" },
    ));

  it("is skipped when node_modules exists", () =>
    withProject(
      yaml,
      async (directory, provision) => {
        await provision();

        expect(existsSync(join(directory, "install.log"))).toBe(false);
      },
      { "fe/node_modules/.keep": "" },
    ));
});

describe("command environment", () => {
  const dump = (extra: string[] = [], step = 'run: "env > env.out"') =>
    lines(
      "db:",
      "  dialect: postgres",
      "  host: localhost",
      "  port: 5433",
      "  user: app",
      "  password: secret",
      "  database: appdb",
      "variant:",
      "  instances:",
      "    fe: { kind: vite, dir: fe, open: 'http://{{slug}}.vw.localhost:{{port}}' }",
      "    be: { kind: nestjs, dir: be }",
      "  steps:",
      `    - { name: dump, ${step} }`,
      ...extra,
    );

  it("passes the database settings, the target and the config path", () =>
    withProject(
      () => dump(),
      async (directory, provision) => {
        await provision();
        const env = parseEnv(read(directory, "env.out"));

        expect(env).toMatchObject({
          POSTGRES_HOST: "localhost",
          POSTGRES_PORT: "5433",
          POSTGRES_USER: "app",
          POSTGRES_PASSWORD: "secret",
          POSTGRES_DB: "appdb",
          POSTGRES_SCHEMA: "v_demo",
          VARIANT_SLUG: "demo",
          VARIANT_TARGET: "v_demo",
          VARIANT_CONFIG: join(directory, "variants.yaml"),
        });
      },
    ));

  it("passes SQLITE_DATABASE for SQLite", () =>
    withProject(
      () => lines("db:", "  dialect: sqlite", "variant:", "  steps:", '    - { name: dump, run: "env > env.out" }'),
      async (directory, provision) => {
        await provision();

        expect(parseEnv(read(directory, "env.out")).SQLITE_DATABASE).toBe(
          join(directory, ".cache", "variants", "demo.db"),
        );
      },
    ));

  it("rewrites host.docker.internal to 127.0.0.1 for host commands", () =>
    withProject(
      () => dump().replace("host: localhost", "host: host.docker.internal"),
      async (directory, provision) => {
        await provision();

        expect(parseEnv(read(directory, "env.out")).POSTGRES_HOST).toBe("127.0.0.1");
      },
    ));

  it("exposes the port and URL of every instance", () =>
    withProject(
      () => dump(),
      async (directory, provision) => {
        await provision();
        const env = parseEnv(read(directory, "env.out"));

        expect(env.VARIANT_FE_PORT).toBe("62060");
        expect(env.VARIANT_BE_PORT).toBe("62061");
        expect(env.VARIANT_FE_URL).toBe("http://demo.vw.localhost:62060");
        expect(env.VARIANT_BE_URL).toBeUndefined();
      },
      { "variants.local.yaml": "runtime:\n  instances:\n    fe:\n      port: 62060\n    be:\n      port: 62061\n" },
    ));

  it("lets the expanded step env win", () =>
    withProject(
      () => dump([], 'run: "env > env.out", env: { POSTGRES_SCHEMA: "custom", PEER: "{{port.be}}" }'),
      async (directory, provision) => {
        await provision();
        const env = parseEnv(read(directory, "env.out"));

        expect(env.POSTGRES_SCHEMA).toBe("custom");
        expect(env.PEER).toBe("62061");
      },
      { "variants.local.yaml": "runtime:\n  instances:\n    fe:\n      port: 62060\n    be:\n      port: 62061\n" },
    ));
});

describe("variant storage", () => {
  const yaml = (storage: string[]) =>
    lines("db:", "  dialect: sqlite", "variant:", ...storage, "  steps:", '    - { name: dump, run: "env > env.out" }');

  it("creates the default directory and passes STORAGE_ROOT", () =>
    withProject(
      () => yaml(["  storage: {}"]),
      async (directory, provision) => {
        await provision();

        expect(statSync(join(directory, ".storage")).isDirectory()).toBe(true);
        expect(parseEnv(read(directory, "env.out")).STORAGE_ROOT).toBe(join(directory, ".storage"));
      },
    ));

  it("uses a custom variable", () =>
    withProject(
      () => yaml(["  storage:", "    env: APP_DATA"]),
      async (directory, provision) => {
        await provision();
        const env = parseEnv(read(directory, "env.out"));

        expect(env.APP_DATA).toBe(join(directory, ".storage"));
        expect(env.STORAGE_ROOT).toBeUndefined();
      },
    ));

  it("creates nothing when storage is not configured", () =>
    withProject(
      () => yaml([]),
      async (directory, provision) => {
        await provision();

        expect(existsSync(join(directory, ".storage"))).toBe(false);
        expect(parseEnv(read(directory, "env.out")).STORAGE_ROOT).toBeUndefined();
      },
    ));
});

/** A git repository `repo` with a tracked-free `be/.env` in the primary worktree; provisioning runs in `_v-demo`. */
const withRepo = async (
  yaml: string,
  primaryFiles: Record<string, string>,
  run: (repo: string, worktree: string) => Promise<void> | void,
  prepare: (worktree: string) => void = () => {},
): Promise<void> => {
  const parent = realpathSync(mkdtempSync(join("/tmp", "variant-dotenv-")));
  const repo = join(parent, "repo");
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  try {
    execFileSync("git", ["init", "-q", "-b", "main", repo]);
    git("config", "user.email", "variant@example.test");
    git("config", "user.name", "Variant Tests");
    writeFileSync(join(repo, "variants.yaml"), yaml);
    writeFileSync(join(repo, ".gitignore"), ".cache\n_v-*\nvariants.local.yaml\n.env\n");
    mkdirSync(join(repo, "be"));
    writeFileSync(join(repo, "be", ".keep"), "");
    git("add", ".");
    git("commit", "-q", "-m", "initial");
    for (const [path, content] of Object.entries(primaryFiles)) {
      mkdirSync(join(repo, path, ".."), { recursive: true });
      writeFileSync(join(repo, path), content);
    }
    const worktree = join(repo, "_v-demo");
    git("worktree", "add", "-q", "-b", "feat/demo", worktree);
    prepare(worktree);
    await run(repo, worktree);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
};

const provisionIn = async (repo: string) => {
  const client = createClient({
    config: loadConfig({ cwd: repo, env: process.env }),
    cwd: repo,
    stateDir: join(repo, ".cache", "variants"),
  });
  return client.provision("demo");
};

const DOTENV_YAML = (extra: string[] = []) =>
  lines(
    "db:",
    "  dialect: sqlite",
    "variant:",
    "  instances:",
    "    be:",
    "      kind: nestjs",
    "      dir: be",
    "      dotenv: .env",
    "      env: { PORT: '{{port}}' }",
    ...extra,
  );

describe("dotenv copy", () => {
  it("copies the primary worktree's file with env applied and names the source", () =>
    withRepo(DOTENV_YAML(), { "be/.env": "PORT=3000\nKEEP=1\n" }, async (repo, worktree) => {
      const { output } = await provisionIn(repo);

      expect(read(worktree, "be/.env")).toMatch(/^PORT=\d+\nKEEP=1\n$/);
      expect(output).toContain(join(repo, "be", ".env"));
      expect(read(repo, "be/.env")).toBe("PORT=3000\nKEEP=1\n");
    }));

  it("keeps an existing file, says the copy was skipped and applies only envAlways", () =>
    withRepo(
      DOTENV_YAML(["      envAlways: { PUBLIC_BASE_URL: 'http://demo.localhost' }"]),
      { "be/.env": "PORT=3000\n" },
      async (repo, worktree) => {
        const { output } = await provisionIn(repo);

        expect(read(worktree, "be/.env")).toBe("PORT=1\nPUBLIC_BASE_URL=http://demo.localhost\n");
        expect(output.toLowerCase()).toContain("skip");
      },
      (worktree) => writeFileSync(join(worktree, "be", ".env"), "PORT=1\n"),
    ));

  it("copies from dotenvSource, and from VARIANT_ENV_SOURCE over it", () =>
    withRepo(
      DOTENV_YAML(["      dotenvSource: /tmp/variant-dotenv-source.env"]),
      { "be/.env": "PORT=3000\n" },
      async (repo, worktree) => {
        writeFileSync("/tmp/variant-dotenv-source.env", "FROM=configured\n");
        writeFileSync("/tmp/variant-dotenv-source-env.env", "FROM=environment\n");
        try {
          setEnv("VARIANT_ENV_SOURCE", "/tmp/variant-dotenv-source-env.env");
          await provisionIn(repo);

          expect(read(worktree, "be/.env")).toContain("FROM=environment");
          rmSync(join(worktree, "be", ".env"));
          setEnv("VARIANT_ENV_SOURCE", undefined);
          await provisionIn(repo);

          expect(read(worktree, "be/.env")).toContain("FROM=configured");
        } finally {
          rmSync("/tmp/variant-dotenv-source.env", { force: true });
          rmSync("/tmp/variant-dotenv-source-env.env", { force: true });
        }
      },
    ));

  it("falls back to the .example file, then to an empty file with a warning", () =>
    withRepo(DOTENV_YAML(), { "be/.env.example": "FROM=example\n" }, async (repo, worktree) => {
      await provisionIn(repo);
      expect(read(worktree, "be/.env")).toContain("FROM=example");

      rmSync(join(worktree, "be", ".env"));
      rmSync(join(repo, "be", ".env.example"));
      const { output } = await provisionIn(repo);

      expect(read(worktree, "be/.env")).toMatch(/^PORT=\d+\n$/);
      expect(output.toLowerCase()).toContain("warning");
    }));

  it("applies only envAlways in the primary worktree and copies nothing", () =>
    withRepo(DOTENV_YAML(["      envAlways: { EXTRA: x }"]), { "be/.env": "PORT=3000\n" }, async (repo) => {
      const client = createClient({
        config: loadConfig({ cwd: repo, env: process.env }),
        cwd: repo,
        stateDir: join(repo, ".cache", "variants"),
        worktree: false,
      });

      await client.provision("main");

      expect(read(repo, "be/.env")).toBe("PORT=3000\nEXTRA=x\n");
    }));
});
