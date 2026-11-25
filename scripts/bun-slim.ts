/**
 * Find and download the slim Bun runtime that github.com/jubr/bun-slim publishes for the Bun version `mise.toml` pins.
 *
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release executables use the published slim runtime)
 * Specification: openspec/specs/meta/bun-bump/spec.md (Bun version bump)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const SLIM_REPOSITORY = "jubr/bun-slim";

/** Runs `gh` with these arguments and returns what it printed; throws when it fails. */
export type Gh = (args: string[]) => string;

export interface SlimRelease {
  tag: string;
  version: string;
  build: number;
}

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

/** The Bun version the `[tools]` table of `mise.toml` pins. It must be exact: the slim release is picked by it. */
export const miseBunVersion = (toml: string): string => {
  const match = /^bun\s*=\s*"([^"]*)"/m.exec(toml);
  if (match === null) {
    throw new Error("mise.toml pins no bun version");
  }
  const version = match[1] as string;
  if (!EXACT_VERSION.test(version)) {
    throw new Error(`mise.toml pins bun "${version}", which is not an exact major.minor.patch version`);
  }
  return version;
};

/** `bun-slim-vX.Y.Z-N`: the release of build N on Bun X.Y.Z. */
export const parseSlimTag = (tag: string): SlimRelease | undefined => {
  const match = /^bun-slim-v(\d+\.\d+\.\d+)-(\d+)$/.exec(tag);
  return match === null ? undefined : { tag, version: match[1] as string, build: Number(match[2]) };
};

const compareVersions = (left: string, right: string): number => {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0);
};

/** The newest release of `version`, or of any version when none is given: the highest version, then the highest build. */
export const latestSlimRelease = (tags: string[], version?: string): SlimRelease | undefined =>
  tags
    .map(parseSlimTag)
    .filter((release): release is SlimRelease => release !== undefined && (version === undefined || release.version === version))
    .sort((left, right) => compareVersions(right.version, left.version) || right.build - left.build)[0];

/** The zip of a platform (`linux-x64`, `darwin-arm64`) in any release. */
export const slimAssetPattern = (platform: string): string => `bun-slim-${platform}-v*.zip`;

export const releaseTags = (gh: Gh): string[] =>
  (JSON.parse(gh(["release", "list", "-R", SLIM_REPOSITORY, "--limit", "100", "--json", "tagName"])) as { tagName: string }[]).map(
    (release) => release.tagName,
  );

const sha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

const findRuntime = (directory: string): string | undefined => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      const found = findRuntime(path);
      if (found !== undefined) {
        return found;
      }
    } else if (name === "bun-slim") {
      return path;
    }
  }
  return undefined;
};

/**
 * Download the slim runtime zip of `platform` from the newest build of Bun `version`, check it against `SHA256SUMS`,
 * unpack it into `outDirectory`, and return the path of the executable. Throws when anything is missing or wrong.
 */
export const fetchSlimRuntime = (input: {
  platform: string;
  version: string;
  outDirectory: string;
  gh: Gh;
  unzip: (zip: string, directory: string) => void;
}): string => {
  const release = latestSlimRelease(releaseTags(input.gh), input.version);
  if (release === undefined) {
    throw new Error(`${SLIM_REPOSITORY} has no release for Bun ${input.version}`);
  }
  const pattern = slimAssetPattern(input.platform);
  input.gh([
    "release",
    "download",
    release.tag,
    "-R",
    SLIM_REPOSITORY,
    "-p",
    pattern,
    "-p",
    "SHA256SUMS",
    "-D",
    input.outDirectory,
    "--clobber",
  ]);
  const zipName = pattern.replace("v*", `v${release.version}-${release.build}`);
  const zip = join(input.outDirectory, zipName);
  const sums = readFileSync(join(input.outDirectory, "SHA256SUMS"), "utf8");
  const line = sums.split("\n").find((entry) => entry.trim().endsWith(` ${zipName}`));
  if (line === undefined) {
    throw new Error(`SHA256SUMS of ${release.tag} does not list ${zipName}`);
  }
  if (!existsSync(zip) || sha256(zip) !== line.trim().split(/\s+/)[0]) {
    throw new Error(`checksum of ${zipName} does not match SHA256SUMS of ${release.tag}`);
  }
  input.unzip(zip, input.outDirectory);
  const runtime = findRuntime(join(input.outDirectory, zipName.replace(/\.zip$/, "")));
  if (runtime === undefined) {
    throw new Error(`${zipName} holds no bun-slim executable`);
  }
  chmodSync(runtime, 0o755);
  return runtime;
};

/** The Bun version and build number of a runtime unpacked from a bun-slim release zip, read from its directory (`bun-slim-darwin-arm64-v1.4.5-0/bun-slim`). */
export const slimRuntimeRelease = (executable: string): { version: string; build: string } | undefined => {
  const match = /^bun-(?:slim|alone)-[a-z0-9]+-[a-z0-9]+-v(\d+\.\d+\.\d+)-(\d+)$/.exec(basename(dirname(executable)));
  return match === null ? undefined : { version: match[1] as string, build: match[2] as string };
};

const ghCli: Gh = (args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const unzipCli = (zip: string, directory: string): void => {
  execFileSync("unzip", ["-q", "-o", zip, "-d", directory], { stdio: ["ignore", "pipe", "pipe"] });
};

/** Fetch the slim runtime of `platform` for the Bun version `root/mise.toml` pins, into `root/.cache/bun-slim/<platform>`. */
export const fetchSlimRuntimeFor = (root: string, platform: string): string =>
  fetchSlimRuntime({
    platform,
    version: miseBunVersion(readFileSync(join(root, "mise.toml"), "utf8")),
    outDirectory: join(root, ".cache", "bun-slim", platform),
    gh: ghCli,
    unzip: unzipCli,
  });

/** Throws unless the `--version` output names the slim runtime of Bun `bunVersion` (`bun-slim-v<bunVersion>-<build>`). */
export const expectSlimRuntime = (versionOutput: string, bunVersion: string): void => {
  const escaped = bunVersion.replaceAll(".", "\\.");
  if (!new RegExp(`, bun-slim-v${escaped}-\\d+, `).test(versionOutput)) {
    const found = versionOutput.trimEnd().split("\n").at(-1);
    throw new Error(`expected the slim runtime bun-slim-v${bunVersion}-<build> in the version line, found: ${found}`);
  }
};
