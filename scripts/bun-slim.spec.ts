/**
 * Specification: openspec/specs/meta/release-artifacts/spec.md (Release executables use the published slim runtime)
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchSlimRuntime,
  expectSlimRuntime,
  type Gh,
  latestSlimRelease,
  miseBunVersion,
  parseSlimTag,
  SLIM_REPOSITORY,
  slimAssetPattern,
} from "./bun-slim.ts";

const directories: string[] = [];
const temporary = (): string => {
  const directory = mkdtempSync(join("/tmp", "bun-slim-"));
  directories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("miseBunVersion", () => {
  test("reads the Bun version the tools table pins", () => {
    expect(miseBunVersion('[tools]\nactionlint = "1.7.12"\nbun = "1.4.5"\nhk = "2.8.0"\n')).toBe("1.4.5");
  });

  test("ignores a commented line and fails when Bun is not pinned", () => {
    expect(miseBunVersion('# bun = "9.9.9"\nbun = "1.4.5"\n')).toBe("1.4.5");
    expect(() => miseBunVersion('[tools]\nhk = "2.8.0"\n')).toThrow("bun");
  });

  test("rejects a version that is not exact, because the release is picked by it", () => {
    expect(() => miseBunVersion('bun = "latest"\n')).toThrow("latest");
  });
});

describe("slim release tags", () => {
  test("parses bun-slim-vX.Y.Z-N and nothing else", () => {
    expect(parseSlimTag("bun-slim-v1.4.5-0")).toEqual({ tag: "bun-slim-v1.4.5-0", version: "1.4.5", build: 0 });
    expect(parseSlimTag("bun-slim-v1.4.12-3")).toEqual({ tag: "bun-slim-v1.4.12-3", version: "1.4.12", build: 3 });
    expect(parseSlimTag("bun-slim-v1.4.5")).toBeUndefined();
    expect(parseSlimTag("v1.4.5-0")).toBeUndefined();
    expect(parseSlimTag("bun-slim-v1.4.5-0-rc")).toBeUndefined();
  });

  test("picks the highest build of the wanted version", () => {
    const tags = ["bun-slim-v1.4.5-0", "bun-slim-v1.4.5-2", "bun-slim-v1.4.5-10", "bun-slim-v1.4.6-0", "nightly"];

    expect(latestSlimRelease(tags, "1.4.5")?.tag).toBe("bun-slim-v1.4.5-10");
    expect(latestSlimRelease(tags, "1.4.4")).toBeUndefined();
  });

  test("picks the highest version, then the highest build, when no version is wanted", () => {
    const tags = ["bun-slim-v1.4.9-4", "bun-slim-v1.4.10-0", "bun-slim-v1.4.10-1", "bun-slim-v1.3.99-7"];

    expect(latestSlimRelease(tags)?.tag).toBe("bun-slim-v1.4.10-1");
    expect(latestSlimRelease([])).toBeUndefined();
  });

  test("names the asset of a platform with a version wildcard", () => {
    expect(slimAssetPattern("linux-x64")).toBe("bun-slim-linux-x64-v*.zip");
    expect(slimAssetPattern("darwin-arm64")).toBe("bun-slim-darwin-arm64-v*.zip");
  });
});

const sha = (bytes: string): string => createHash("sha256").update(bytes).digest("hex");

/** A `gh` that knows one release: it lists the tags and writes the asked-for files into the download directory. */
const fakeGh = (input: { tags: string[]; zip: string; sums?: (zipName: string) => string; calls?: string[][] }): Gh => {
  return (args) => {
    input.calls?.push(args);
    if (args[0] === "release" && args[1] === "list") {
      return JSON.stringify(input.tags.map((tagName) => ({ tagName })));
    }
    if (args[0] === "release" && args[1] === "download") {
      const directory = args[args.indexOf("-D") + 1] as string;
      const pattern = args[args.indexOf("-p") + 1] as string;
      const zipName = pattern.replace("v*", `v${(args[2] as string).replace("bun-slim-v", "")}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, zipName), input.zip);
      writeFileSync(join(directory, "SHA256SUMS"), input.sums?.(zipName) ?? `${sha(input.zip)}  ${zipName}\n`);
      return "";
    }
    throw new Error(`unexpected gh ${args.join(" ")}`);
  };
};

/** An unzip that puts the runtime where the real archive does: in a folder named like the zip. */
const fakeUnzip = (zip: string, directory: string): void => {
  const folder = join(directory, zip.replace(/\.zip$/, "").split("/").pop() as string);
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "bun-slim"), "runtime");
};

describe("fetchSlimRuntime", () => {
  test("downloads the zip of the platform from the latest build of the pinned Bun version and returns the runtime", () => {
    const calls: string[][] = [];
    const out = temporary();
    const runtime = fetchSlimRuntime({
      platform: "linux-x64",
      version: "1.4.5",
      outDirectory: out,
      gh: fakeGh({ tags: ["bun-slim-v1.4.5-0", "bun-slim-v1.4.5-1", "bun-slim-v1.4.6-0"], zip: "zip bytes", calls }),
      unzip: fakeUnzip,
    });

    expect(runtime).toBe(join(out, "bun-slim-linux-x64-v1.4.5-1", "bun-slim"));
    expect(readFileSync(runtime, "utf8")).toBe("runtime");
    expect(calls[0]).toEqual(["release", "list", "-R", SLIM_REPOSITORY, "--limit", "100", "--json", "tagName"]);
    expect(calls[1]).toEqual([
      "release",
      "download",
      "bun-slim-v1.4.5-1",
      "-R",
      SLIM_REPOSITORY,
      "-p",
      "bun-slim-linux-x64-v*.zip",
      "-p",
      "SHA256SUMS",
      "-D",
      out,
      "--clobber",
    ]);
    expect(statSync(runtime).mode & 0o111).not.toBe(0);
  });

  test("fails naming the version when no release was built for it", () => {
    expect(() =>
      fetchSlimRuntime({
        platform: "linux-x64",
        version: "1.4.2",
        outDirectory: temporary(),
        gh: fakeGh({ tags: ["bun-slim-v1.4.5-0"], zip: "zip bytes" }),
        unzip: fakeUnzip,
      }),
    ).toThrow("1.4.2");
  });

  test("fails when the zip does not match its checksum", () => {
    expect(() =>
      fetchSlimRuntime({
        platform: "linux-x64",
        version: "1.4.5",
        outDirectory: temporary(),
        gh: fakeGh({ tags: ["bun-slim-v1.4.5-0"], zip: "zip bytes", sums: (name) => `${"0".repeat(64)}  ${name}\n` }),
        unzip: fakeUnzip,
      }),
    ).toThrow("checksum");
  });

  test("fails when the checksum file does not list the zip", () => {
    expect(() =>
      fetchSlimRuntime({
        platform: "linux-x64",
        version: "1.4.5",
        outDirectory: temporary(),
        gh: fakeGh({ tags: ["bun-slim-v1.4.5-0"], zip: "zip bytes", sums: () => `${sha("zip bytes")}  other.zip\n` }),
        unzip: fakeUnzip,
      }),
    ).toThrow("SHA256SUMS");
  });

  test("fails when the archive holds no bun-slim executable", () => {
    expect(() =>
      fetchSlimRuntime({
        platform: "linux-x64",
        version: "1.4.5",
        outDirectory: temporary(),
        gh: fakeGh({ tags: ["bun-slim-v1.4.5-0"], zip: "zip bytes" }),
        unzip: () => undefined,
      }),
    ).toThrow("bun-slim");
  });
});

describe("fetch-bun-slim script", () => {
  const script = join(import.meta.dir, "fetch-bun-slim.ts");

  /** Run the script with a `gh` that always fails first on the PATH. */
  const run = async (platform: string): Promise<{ exitCode: number; stdout: string; githubEnv: string }> => {
    const directory = temporary();
    const bin = join(directory, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "gh"), "#!/bin/sh\necho 'gh: network is down' >&2\nexit 1\n");
    chmodSync(join(bin, "gh"), 0o755);
    const githubEnv = join(directory, "github-env");
    writeFileSync(githubEnv, "");
    const process_ = Bun.spawn(["bun", script, platform], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_ENV: githubEnv },
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, exitCode] = await Promise.all([new Response(process_.stdout).text(), process_.exited]);
    return { exitCode, stdout, githubEnv: readFileSync(githubEnv, "utf8") };
  };

  test("warns and leaves VARIANT_BUN_RUNTIME unset when the fetch fails, so the default runtime is used", async () => {
    const result = await run("linux-x64");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("::warning::");
    expect(result.stdout).toContain("default");
    expect(result.githubEnv).toBe("");
  });
});

describe("expectSlimRuntime", () => {
  const details = (runtime: string): string =>
    `1.2.3 (2001-02-03)\nlinux-x64, ${runtime}, https://github.com/jubr/variant-worktrees`;

  test("accepts the version line of an executable with the slim runtime of the pinned Bun version", () => {
    expect(() => expectSlimRuntime(details("bun-slim-v1.4.5-0"), "1.4.5")).not.toThrow();
    expect(() => expectSlimRuntime(details("bun-slim-v1.4.5-12"), "1.4.5")).not.toThrow();
  });

  test("fails naming the runtime found when the executable embeds the default runtime", () => {
    expect(() => expectSlimRuntime(details("bun-v1.4.5"), "1.4.5")).toThrow("bun-v1.4.5");
  });

  test("fails when the slim runtime is of another Bun version than the pinned one", () => {
    expect(() => expectSlimRuntime(details("bun-slim-v1.4.4-0"), "1.4.5")).toThrow("1.4.5");
  });

  test("fails on a version line without a runtime", () => {
    expect(() => expectSlimRuntime("1.2.3 (2001-02-03)", "1.4.5")).toThrow("1.4.5");
  });
});
