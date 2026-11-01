/**
 * Specification: openspec/specs/variant-cli/package/spec.md (Runs on Node and Bun)
 *
 * Runs the built `dist/cli.js` under Node and Bun and a compiled single-file executable: `bun run test` builds first.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { runCommand, withVariants } from "./support/cli.js";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist/cli.js");
const { version } = (await Bun.file(join(root, "package.json")).json()) as { version: string };

let compiledDirectory: string;
let compiled: string;

beforeAll(async () => {
  compiledDirectory = mkdtempSync(join("/tmp", "variant-compiled-"));
  compiled = join(compiledDirectory, "variant");
  const build = Bun.spawnSync(["bun", "build", join(root, "src/cli.ts"), "--compile", "--outfile", compiled], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(build.exitCode).toBe(0);
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
  for (const [name, command] of runners) {
    it(`prints the version of variant-cli alone with --version under ${name}`, async () => {
      const result = await runCommand(command(), ["--version"]);

      expect(result.stdout.trim()).toBe(version);
      expect(result.exitCode).toBe(0);
    });

    it(`shows the version in the help header under ${name}`, async () => {
      const result = await runCommand(command(), ["--help"]);

      expect(result.stdout).toContain(`variant v${version}`);
      expect(result.exitCode).toBe(0);
    });

    it(`creates and lists a SQLite variant under ${name}`, () =>
      withVariants(async (environment, directory) => {
        const created = await runCommand(command(), ["create", "-s", "gamma", "--json"], environment);
        expect(created.stderr).toBe("");
        expect(existsSync(join(directory, ".cache/variants/gamma.db"))).toBe(true);

        const listed = await runCommand(command(), ["list", "--json"], environment);
        expect(listed.exitCode).toBe(0);
        expect((JSON.parse(listed.stdout) as { slug: string }[]).map((record) => record.slug)).toEqual([
          "alpha",
          "beta",
          "gamma",
        ]);
      }));
  }
});
