import { logToStderr } from "./ready.js";

/** Receives progress lines; the default writes to stderr. */
export type ProgressLog = (line: string) => void;

/** Prints a command line, as `$ <command>`, before it runs. */
export const echoCommand = (command: string, log: ProgressLog = logToStderr): void => log(`$ ${command}`);

/** An engine command as printed: the value of every `-e NAME=value` argument is hidden, it may hold secrets. */
export const engineCommandLine = (engine: string, args: string[]): string =>
  [
    engine,
    ...args.map((arg, index) =>
      args[index - 1] === "-e" ? `${arg.slice(0, Math.max(arg.indexOf("="), 0))}=***` : arg,
    ),
  ].join(" ");
