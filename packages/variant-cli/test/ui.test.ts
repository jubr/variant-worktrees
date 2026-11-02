/**
 * Specification: openspec/specs/variant-server/ui-instance/spec.md
 *
 * `variant ui` from source in a child process, in a SQLite project in a temporary directory.
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { runCommand, withVariants } from "./support/cli.js";

const cli = ["bun", "run", join(import.meta.dir, "../src/cli.ts")];
const URL_LINE = /^http:\/\/ui\.[a-z0-9-]+\.localhost:\d+\/\?token=[A-Za-z0-9_-]+$/;

interface Listed {
  slug: string;
  instances?: Record<string, { port?: number; pid?: number; url?: string; alive?: boolean }>;
}

const listed = async (environment: Record<string, string>, directory: string): Promise<Listed[]> =>
  JSON.parse((await runCommand(cli, ["list", "--json"], environment, directory)).stdout) as Listed[];

describe("variant ui", () => {
  it("is among the commands, with --detach and --stop", async () => {
    const top = await runCommand(cli, ["--help"]);
    const help = await runCommand(cli, ["ui", "--help"]);

    expect(top.stdout).toContain("ui");
    expect(help.exitCode).toBe(0);
    expect(help.stdout).toContain("--detach");
    expect(help.stdout).toContain("--stop");
  });

  it(
    "starts in the background, prints its URL with the token, and is recorded as the variant-ui instance of main",
    () =>
      withVariants(async (environment, directory) => {
        try {
          const started = await runCommand(cli, ["ui", "--detach"], environment, directory);

          expect(started.exitCode).toBe(0);
          expect(started.stdout.trim()).toMatch(URL_LINE);
          const main = (await listed(environment, directory)).find((record) => record.slug === "main");
          const instance = main?.instances?.["variant-ui"];
          expect(instance?.alive).toBe(true);
          expect(started.stdout).toContain(instance?.url as string);
        } finally {
          await runCommand(cli, ["ui", "--stop"], environment, directory);
        }
      }),
    60_000,
  );

  it(
    "prints the running server's URL and starts no second server",
    () =>
      withVariants(async (environment, directory) => {
        try {
          const first = await runCommand(cli, ["ui", "--detach"], environment, directory);
          const second = await runCommand(cli, ["ui"], environment, directory);

          expect(second.exitCode).toBe(0);
          expect(second.stdout.trim()).toBe(first.stdout.trim());
        } finally {
          await runCommand(cli, ["ui", "--stop"], environment, directory);
        }
      }),
    60_000,
  );

  it(
    "stops the server with --stop, and exits 0 when none runs",
    () =>
      withVariants(async (environment, directory) => {
        await runCommand(cli, ["ui", "--detach"], environment, directory);

        const stopped = await runCommand(cli, ["ui", "--stop"], environment, directory);
        const again = await runCommand(cli, ["ui", "--stop"], environment, directory);

        expect(stopped.exitCode).toBe(0);
        expect(again.exitCode).toBe(0);
        const main = (await listed(environment, directory)).find((record) => record.slug === "main");
        expect(main?.instances?.["variant-ui"]).toBeUndefined();
      }),
    60_000,
  );

  it(
    "uses VARIANT_UI_PORT as the port",
    () =>
      withVariants(async (environment, directory) => {
        const port = 40000 + Math.floor(Math.random() * 20000);
        try {
          const started = await runCommand(
            cli,
            ["ui", "--detach"],
            { ...environment, VARIANT_UI_PORT: String(port) },
            directory,
          );

          expect(started.stdout).toContain(`.localhost:${port}/`);
        } finally {
          await runCommand(cli, ["ui", "--stop"], environment, directory);
        }
      }),
    60_000,
  );
});
