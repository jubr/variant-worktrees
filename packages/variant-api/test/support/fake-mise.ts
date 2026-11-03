import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface FakeMiseOptions {
  /** What `mise env --dotenv` prints. */
  env?: string;
  /** What `mise set --raw` prints. */
  set?: string;
  /** What `mise config ls --json` prints. */
  configLs?: string;
  /** When set, `mise env` prints this on stderr and exits 1. */
  envFailure?: string;
  /** When set, `mise trust` prints this on stderr and exits 1. */
  trustFailure?: string;
}

export interface FakeMise {
  /** The executable. */
  binary: string;
  /** Every call as its arguments joined by spaces, such as `-C /proj env --dotenv --quiet`. */
  calls: () => string[];
  /** The calls of one subcommand. */
  callsOf: (subcommand: string) => string[];
}

/** A shell script that stands in for `mise` and records how it was called. */
export const fakeMise = (root: string, options: FakeMiseOptions = {}): FakeMise => {
  const state = join(root, "fake-mise-state");
  mkdirSync(state, { recursive: true });
  const write = (name: string, content: string | undefined): void => {
    if (content !== undefined) {
      writeFileSync(join(state, name), content);
    }
  };
  write("env", options.env ?? "");
  write("set", options.set ?? "");
  write("config-ls", options.configLs ?? "[]");
  write("env-failure", options.envFailure);
  write("trust-failure", options.trustFailure);
  writeFileSync(join(state, "log"), "");
  const binary = join(root, "mise");
  writeFileSync(
    binary,
    [
      "#!/bin/sh",
      `state="${state}"`,
      'echo "$*" >> "$state/log"',
      "shift 2",
      'case "$1" in',
      '  env) if [ -f "$state/env-failure" ]; then cat "$state/env-failure" >&2; exit 1; fi; cat "$state/env";;',
      '  set) cat "$state/set";;',
      '  config) cat "$state/config-ls";;',
      '  trust) if [ -f "$state/trust-failure" ]; then cat "$state/trust-failure" >&2; exit 1; fi;;',
      "esac",
      "",
    ].join("\n"),
  );
  chmodSync(binary, 0o755);
  const calls = (): string[] =>
    existsSync(join(state, "log"))
      ? readFileSync(join(state, "log"), "utf8")
          .split("\n")
          .filter((line) => line !== "")
      : [];
  return {
    binary,
    calls,
    callsOf: (subcommand) => calls().filter((line) => line.split(" ")[2] === subcommand),
  };
};
