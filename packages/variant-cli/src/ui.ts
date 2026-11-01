import { existsSync } from "node:fs";
import { command } from "cleye";
import { renderHelp } from "./help.js";

/** The commands of the CLI that are not in the library's command list, because the library has no use for them. */
export const CLI_ONLY_COMMANDS = ["ui"] as const;

/**
 * The command line that runs `variant ui` attached, which `--detach` starts in the background: the executable and its
 * script (none for a compiled executable, whose script path is virtual) followed by `ui`.
 */
const respawnCommand = (): string[] => {
  const script = process.argv[1];
  return script !== undefined && existsSync(script) ? [process.execPath, script, "ui"] : [process.execPath, "ui"];
};

/**
 * `variant ui`: serves the variants app as a web page; see `variant-server`.
 *
 * AIDEV-NOTE: `variant-server` is imported on use. It is not part of the published `variant-cli` package, so where it
 * is missing the command says so instead of the whole CLI failing to start.
 */
export const uiCommand = () =>
  command(
    {
      name: "ui",
      help: {
        description: "Serve the variants web page on a local port and print its URL with the token",
        render: renderHelp,
      },
      flags: {
        detach: { type: Boolean, description: "Start the server in the background and return after printing the URL" },
        stop: { type: Boolean, description: "Stop the server of the project" },
      },
    },
    async (argv) => {
      const { runUi } = await import("variant-server").catch((error: unknown) => {
        throw new Error(
          `variant ui is not available in this installation: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
      const abort = new AbortController();
      for (const name of ["SIGINT", "SIGTERM"] as const) {
        process.on(name, () => abort.abort());
      }
      process.exitCode = await runUi({
        cwd: process.cwd(),
        env: process.env,
        print: (line) => console.log(line),
        detach: argv.flags.detach,
        stop: argv.flags.stop,
        respawn: respawnCommand(),
        signal: abort.signal,
      });
    },
  );
