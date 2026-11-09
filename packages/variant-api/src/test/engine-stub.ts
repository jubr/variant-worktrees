import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Containers and networks the stub engine knows. */
interface StubState {
  containers: string[];
  networks: string[];
}

export interface EngineStub {
  /** Directory to put first on `PATH`. */
  bin: string;
  /** Every call as its argument list, in order. */
  calls(): string[][];
  /** The names of the containers and networks that currently exist. */
  state(): StubState;
  /** Makes containers and networks exist, as if an earlier `up` created them. */
  seed(state: Partial<StubState>): void;
  /** Makes calls whose arguments start with these words fail with status 1, e.g. `["build"]`. */
  failOn(...words: string[][]): void;
}

const SEPARATOR = "\u001f";

/** The script is the same for every test, so the system scans it once; the data directory comes from the environment. */
const SCRIPT = `#!/bin/sh
d="$ENGINE_STUB_DIR"
{ printf '%s' "$1"; shift_args=0; for a in "$@"; do if [ $shift_args -eq 1 ]; then printf '\\037%s' "$a"; fi; shift_args=1; done; printf '\\n'; } >> "$d/calls.log"
if [ -f "$d/failures" ]; then
  while IFS= read -r words; do
    case "$*" in "$words"*) echo "stub engine: failing $*" >&2; exit 1;; esac
  done < "$d/failures"
fi
touch "$d/containers" "$d/networks"
eval "last=\\\${$#}"
has() { grep -Fxq -- "$2" "$d/$1"; }
drop() { grep -Fxv -- "$2" "$d/$1" > "$d/$1.tmp"; mv "$d/$1.tmp" "$d/$1"; }
name=""
prev=""
for a in "$@"; do
  if [ "$prev" = "--name" ]; then name="$a"; fi
  prev="$a"
done
case "$1" in
  network)
    case "$2" in
      create) has networks "$last" || echo "$last" >> "$d/networks";;
      rm) drop networks "$last";;
      inspect) has networks "$last" || exit 1;;
    esac;;
  inspect) has containers "$last" || exit 1;;
  rm) drop containers "$last";;
  run) if [ -n "$name" ]; then has containers "$name" || echo "$name" >> "$d/containers"; fi;;
esac
exit 0
`;

const lines = (path: string): string[] =>
  existsSync(path)
    ? readFileSync(path, "utf8")
        .split("\n")
        .filter((line) => line !== "")
    : [];

const sharedBin = (engine: string): string => {
  const bin = join(tmpdir(), "variant-api-engine-stub");
  const path = join(bin, engine);
  if (!existsSync(path) || readFileSync(path, "utf8") !== SCRIPT) {
    mkdirSync(bin, { recursive: true });
    writeFileSync(`${path}.${process.pid}`, SCRIPT);
    chmodSync(`${path}.${process.pid}`, 0o755);
    renameSync(`${path}.${process.pid}`, path);
  }
  return bin;
};

/**
 * Provides an executable `docker` (or `podman`) that records its calls and keeps a small world of containers in
 * `directory`. Put `bin` first on `PATH`; this sets `ENGINE_STUB_DIR` for the calls of the test.
 */
export const installEngineStub = (directory: string, engine = "docker"): EngineStub => {
  const bin = sharedBin(engine);
  const data = join(directory, "engine-data");
  mkdirSync(data, { recursive: true });
  process.env.ENGINE_STUB_DIR = data;
  const state = (): StubState => ({
    containers: lines(join(data, "containers")),
    networks: lines(join(data, "networks")),
  });
  return {
    bin,
    calls: () => lines(join(data, "calls.log")).map((line) => line.split(SEPARATOR)),
    state,
    seed: (seed) => {
      const next = { ...state(), ...seed };
      writeFileSync(join(data, "containers"), next.containers.map((name) => `${name}\n`).join(""));
      writeFileSync(join(data, "networks"), next.networks.map((name) => `${name}\n`).join(""));
    },
    failOn: (...words) => writeFileSync(join(data, "failures"), words.map((entry) => `${entry.join(" ")}\n`).join("")),
  };
};
