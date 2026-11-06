/**
 * Specification: openspec/specs/variant-cli/package/spec.md (Runs on Node and Bun, The UI server is part of the CLI)
 *
 * Runs the built `dist/cli.js` under Node and Bun and a compiled single-file executable: `bun run test` builds first.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { compileCli } from "../../../scripts/package-cli.ts";
import { platformToken, VERSION_BANNER } from "../src/version-line.js";
import { runCommand, withVariants } from "./support/cli.js";

const root = join(import.meta.dir, "..");
const repo = join(root, "../..");
const built = join(root, "dist");
const { version } = (await Bun.file(join(root, "package.json")).json()) as { version: string };

/** The version token this checkout would stamp, computed from git rather than from the build helper. */
const bakedToken = (): string => {
  const git = (args: string[]): string => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = git(["rev-parse", "HEAD"]);
  let commits = git(["rev-list", "--count", "HEAD"]);
  try {
    const tag = git(["describe", "--tags", "--abbrev=0"]);
    commits = git(["rev-list", "--count", `${tag}..HEAD`]);
  } catch {
    // A checkout with no tag counts every commit.
  }
  const slug = branch.replace(/^(feat|fix|feature)\//, "");
  const suffix = branch === "main" ? "" : `-${slug}-${commits}-${commit.slice(0, 4)}`;
  return `${version}${suffix}`;
};

const detailsLine = `${platformToken(process.platform, process.arch)}, https://github.com/jubr/variant-worktrees`;

const expectBakedVersion = (stdout: string): void => {
  const lines = stdout.trimEnd().split("\n");
  const token = bakedToken().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(lines[0]).toMatch(new RegExp(`^${token} \\(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\)$`));
  expect(lines.slice(1, 6).join("\n")).toBe(VERSION_BANNER);
  expect(lines[6]).toBe("");
  expect(lines[7]).toBe(detailsLine);
};

let compiledDirectory: string;
let compiled: string;
let dist: string;

/**
 * The built package as an install of it from the registry: `dist` next to the dependencies a registry install brings.
 * Workspace-only packages (the server and the app are not dependencies of the CLI) are left out of `node_modules`.
 */
const installLikeRegistry = (directory: string): string => {
  const modules = join(root, "../../node_modules");
  mkdirSync(join(directory, "package/node_modules"), { recursive: true });
  for (const name of readdirSync(modules)) {
    if (name !== "variant-server" && name !== "variant-ui") {
      symlinkSync(join(modules, name), join(directory, "package/node_modules", name));
    }
  }
  cpSync(built, join(directory, "package/dist"), { recursive: true });
  return join(directory, "package/dist/cli.js");
};

beforeAll(async () => {
  compiledDirectory = mkdtempSync(join("/tmp", "variant-compiled-"));
  dist = installLikeRegistry(compiledDirectory);
  compiled = join(compiledDirectory, "variant");
  await compileCli(join(root, "../.."), compiled);
}, 60_000);

afterAll(() => {
  rmSync(compiledDirectory, { recursive: true, force: true });
});

/** Each way to run the CLI; the command is a function because the executable exists only after `beforeAll`. */
const runners: [name: string, command: () => string[]][] = [
  ["node", () => ["node", dist]],
  ["bun", () => ["bun", dist]],
  ["the compiled executable", () => [compiled]],
];

describe("variant on Node, Bun and as a compiled executable", () => {
  const versionOut: Record<string, string> = {};

  for (const [name, command] of runners) {
    it(`prints the baked version line with --version under ${name}`, async () => {
      const result = await runCommand(command(), ["--version"], {}, compiledDirectory);

      expect(result.exitCode).toBe(0);
      expectBakedVersion(result.stdout);
      versionOut[name] = result.stdout;
    });

    it(`shows the version in the help header under ${name}`, async () => {
      const result = await runCommand(command(), ["--help"], {}, compiledDirectory);

      expect(result.stdout.trimStart().startsWith(`variant v${version}`)).toBe(true);
      expect(result.stdout).not.toContain(VERSION_BANNER);
      expect(result.stdout).not.toContain("https://github.com/jubr/variant-worktrees");
      expect(result.exitCode).toBe(0);
    });

    it(`creates and lists a SQLite variant under ${name}`, () =>
      withVariants(async (environment, directory) => {
        execFileSync("git", ["init", "-q", "-b", "main", directory]);
        execFileSync("git", ["-C", directory, "config", "user.email", "variant@example.test"]);
        execFileSync("git", ["-C", directory, "config", "user.name", "Variant Tests"]);
        execFileSync("git", ["-C", directory, "add", "variants.yaml"]);
        execFileSync("git", ["-C", directory, "commit", "-q", "-m", "initial"]);
        const worktree = { ...environment, VARIANT_WORKTREE: "1" };
        const created = await runCommand(command(), ["create", "-s", "gamma", "--json"], worktree, directory);
        expect(created.stderr).toBe("");
        expect(existsSync(join(directory, ".cache/variants/gamma.db"))).toBe(false);
        expect(existsSync(join(directory, ".cache/variants/gamma.yaml"))).toBe(false);
        expect(existsSync(join(directory, "_v-gamma", ".cache/variant/state.yaml"))).toBe(true);

        const listed = await runCommand(command(), ["list", "--json"], worktree, directory);
        expect(listed.exitCode).toBe(0);
        expect((JSON.parse(listed.stdout) as { slug: string }[]).map((record) => record.slug)).toEqual([
          "alpha",
          "beta",
          "gamma",
        ]);
      }));

    it(
      `serves the variants app with variant ui under ${name}`,
      () =>
        withVariants(async (environment, directory) => {
          try {
            const started = await runCommand(command(), ["ui", "--detach"], environment, directory);
            expect(started.stderr).toBe("");
            expect(started.exitCode).toBe(0);
            const url = new URL(started.stdout.trim());
            const get = (path: string) =>
              fetch(`http://127.0.0.1:${url.port}${path}`, {
                headers: { authorization: `Bearer ${url.searchParams.get("token")}` },
              });

            const page = await get("/");
            const html = await page.text();
            const script = /src="\.?(\/[^"]+\.js)"/.exec(html)?.[1];
            const bundle = await get(script ?? "/missing.js");

            expect(page.status).toBe(200);
            expect(html).toContain('<div id="root">');
            expect(bundle.status).toBe(200);
            expect(bundle.headers.get("content-type")).toContain("javascript");
          } finally {
            await runCommand(command(), ["ui", "--stop"], environment, directory);
          }
        }),
      60_000,
    );
  }

  it("prints the same version under node and bun", () => {
    expect(versionOut.bun).toBe(versionOut.node);
  });
});

describe("the UI server is not a binary of its own", () => {
  it("leaves variant the only bin among the CLI, the library and the server", async () => {
    const bins = await Promise.all(
      ["variant-cli", "variant-api", "variant-server"].map(async (name) => {
        const manifest = (await Bun.file(join(root, "..", name, "package.json")).json()) as { bin?: object | string };
        return [
          name,
          manifest.bin === undefined ? [] : typeof manifest.bin === "string" ? [name] : Object.keys(manifest.bin),
        ];
      }),
    );

    expect(Object.fromEntries(bins)).toEqual({ "variant-cli": ["variant"], "variant-api": [], "variant-server": [] });
  });
});
