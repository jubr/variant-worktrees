import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createClient } from "../src/index.js";
import { installEngineStub } from "./support/engine-stub.js";

const originalPath = process.env.PATH;
afterEach(() => {
  process.env.PATH = originalPath;
});

const lines = (...entries: string[]): string => `${entries.join("\n")}\n`;

/** A project directory (not a git repository) with the given variants.yaml and a stub container engine. */
const withProject = async (
  yaml: (directory: string) => string,
  run: (project: { directory: string; client: ReturnType<typeof createClient> }) => Promise<void>,
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-echo-")));
  try {
    mkdirSync(join(directory, "fe"));
    mkdirSync(join(directory, "be"));
    writeFileSync(join(directory, "variants.yaml"), yaml(directory));
    process.env.PATH = `${installEngineStub(directory).bin}:${originalPath}`;
    const client = createClient({
      config: loadConfig({ cwd: directory, env: {} }),
      cwd: directory,
      stateDir: join(directory, ".cache", "variants"),
      worktree: false,
    });
    await run({ directory, client });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("provisioning command echo", () => {
  const PROVISIONED = (d: string): string =>
    lines(
      "db:",
      "  dialect: sqlite",
      "variant:",
      "  seed: echo seed",
      "  instances:",
      '    fe: { kind: vite, dir: fe, up: "echo up" }',
      "  steps:",
      '    - { name: one, run: "echo one", show: "^never$" }',
      '    - { name: skipped, run: "echo skipped", unlessEnv: { VARIANT_ECHO_SKIP: "1" } }',
      `    - { name: two, run: "echo two > ${d}/two.txt" }`,
    );

  it("prints each command before it runs, in order, without verbose", () =>
    withProject(PROVISIONED, async ({ directory, client }) => {
      process.env.VARIANT_ECHO_SKIP = "0";
      const log: string[] = [];

      await client.provision("demo", { log: (line) => log.push(line) });

      expect(log).toEqual([
        "+ echo up",
        "+ echo one",
        "+ echo skipped",
        `+ echo two > ${directory}/two.txt`,
        "+ echo seed",
      ]);
    }));

  it("prints nothing for a step that is skipped", () =>
    withProject(PROVISIONED, async ({ client }) => {
      process.env.VARIANT_ECHO_SKIP = "1";
      const log: string[] = [];

      await client.provision("demo", { log: (line) => log.push(line) });
      delete process.env.VARIANT_ECHO_SKIP;

      expect(log).not.toContain("+ echo skipped");
      expect(log).toContain("+ echo one");
    }));

  it("prints the command of a step before it fails", () =>
    withProject(
      () =>
        lines("db:", "  dialect: sqlite", "variant:", "  steps:", '    - { name: broken, run: "echo boom; exit 3" }'),
      async ({ client }) => {
        const log: string[] = [];

        const failure = await client
          .provision("demo", { log: (line) => log.push(line) })
          .catch((error: Error) => error);

        expect(failure).toBeInstanceOf(Error);
        expect(log).toEqual(["+ echo boom; exit 3"]);
      },
    ));
});

const CONTAINERS = lines(
  "db:",
  "  dialect: sqlite",
  "variant:",
  "  instances:",
  '    be: { kind: nestjs, dir: be, container: { build: "echo building", image: app, port: 3000 } }',
  "  supervise: { startDelaySeconds: 0 }",
);

describe("container command echo", () => {
  it("prints the build, network and run commands of up and no inspect call", () =>
    withProject(
      () => CONTAINERS,
      async ({ client }) => {
        const log: string[] = [];

        await client.up("demo", { opener: async () => {}, log: (line) => log.push(line) });

        const echoed = log.filter((line) => line.startsWith("+ "));
        expect(echoed[0]).toBe("+ echo building");
        expect(echoed[1]).toBe("+ docker network create v-net-demo");
        expect(echoed[2]).toStartWith("+ docker run -d --name v-be-demo --network v-net-demo");
        expect(echoed.some((line) => line.includes("inspect"))).toBe(false);
      },
    ));

  it("hides the value of every -e argument", () =>
    withProject(
      () =>
        lines(
          "db:",
          "  dialect: sqlite",
          "variant:",
          "  instances:",
          "    be: { kind: nestjs, dir: be, env: { TOKEN: hunter2 }, container: { image: app, port: 3000 } }",
          "  supervise: { startDelaySeconds: 0 }",
        ),
      async ({ client }) => {
        const log: string[] = [];

        await client.up("demo", { opener: async () => {}, log: (line) => log.push(line) });

        const run = log.find((line) => line.startsWith("+ docker run")) as string;
        expect(run).toContain("-e TOKEN=***");
        expect(run).toContain("-e VARIANT_SLUG=***");
        expect(log.join("\n")).not.toContain("hunter2");
      },
    ));

  it("prints the engine commands of down", () =>
    withProject(
      () => CONTAINERS,
      async ({ client }) => {
        await client.up("demo", { opener: async () => {}, log: () => {} });
        const log: string[] = [];

        await client.down("demo", { log: (line) => log.push(line) });

        expect(log).toEqual(["+ docker rm -f v-be-demo", "+ docker network rm v-net-demo"]);
      },
    ));
});
