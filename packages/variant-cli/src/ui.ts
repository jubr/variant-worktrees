import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { command } from "cleye";
import { runUi, type StaticApp } from "variant-server";
import { UI_DESCRIPTION, UI_FLAGS } from "./cli-flags.js";
import { embeddedApp } from "./embedded-app.js";
import { renderHelp } from "./help.js";

/** The commands of the CLI that are not in the library's command list, because the library has no use for them. */
export const CLI_ONLY_COMMANDS = ["ui"] as const;

/** The script path a compiled executable reports for itself: a file in its embedded file system, which exists only there. */
const EMBEDDED_SCRIPT = /^(\/\$bunfs\/|[A-Za-z]:[\\/]~BUN[\\/])/;

/**
 * The command line that runs `variant ui` attached, which `--detach` starts in the background: the executable and its
 * script (none for a compiled executable, whose script is embedded) followed by `ui`.
 */
const respawnCommand = (): string[] => {
  const script = process.argv[1];
  return script !== undefined && !EMBEDDED_SCRIPT.test(script) && existsSync(script)
    ? [process.execPath, script, "ui"]
    : [process.execPath, "ui"];
};

/** The built app that ships next to the built `cli.js`; none when the CLI runs from source. */
const packagedApp = (): string | undefined => {
  const directory = join(dirname(fileURLToPath(import.meta.url)), "ui");
  return existsSync(join(directory, "index.html")) ? directory : undefined;
};

/** The app to serve: the one embedded in a compiled executable, the one next to `cli.js`, else the server's default. */
const appLocation = (): StaticApp | undefined => embeddedApp ?? packagedApp();

/**
 * `variant ui`: serves the variants app as a web page; see `variant-server`.
 *
 * AIDEV-NOTE: the server is part of this command, not a package of its own: the build bundles `variant-server` into
 * `dist/cli.js` and puts the built app in `dist/ui`.
 */
export const uiCommand = () =>
  command(
    {
      name: "ui",
      help: {
        description: UI_DESCRIPTION,
        render: renderHelp,
      },
      flags: UI_FLAGS,
    },
    async (argv) => {
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
        staticDir: appLocation(),
        signal: abort.signal,
      });
    },
  );
