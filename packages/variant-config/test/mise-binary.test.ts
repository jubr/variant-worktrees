import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../src/index.js";
import { miseSearchPlaces, resolveMiseBinary } from "../src/mise-binary.js";

/** Specification: openspec/specs/tools/mise/spec.md (Mise executable resolution) */

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-mise-binary-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const executable = (path: string): string => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, "#!/bin/sh\n");
  chmodSync(path, 0o755);
  return path;
};

describe("resolveMiseBinary", () => {
  it("prefers the path the caller passes over the configuration key and PATH", () => {
    const editor = executable(join(root, "tools", "mise"));
    const fromConfig = executable(join(root, "config", "mise"));
    executable(join(root, "bin", "mise"));

    expect(
      resolveMiseBinary({ configured: editor, fromConfig, configDir: root, env: { PATH: join(root, "bin") } }),
    ).toBe(editor);
  });

  it("prefers the configuration key over PATH", () => {
    const fromConfig = executable(join(root, "config", "mise"));
    executable(join(root, "bin", "mise"));

    expect(resolveMiseBinary({ fromConfig, configDir: root, env: { PATH: join(root, "bin") } })).toBe(fromConfig);
  });

  it("resolves a relative configuration key against the directory of the file", () => {
    const fromConfig = executable(join(root, "tools", "mise"));

    expect(resolveMiseBinary({ fromConfig: "./tools/mise", configDir: root, env: { PATH: "" }, locations: [] })).toBe(
      fromConfig,
    );
  });

  it("finds mise on PATH", () => {
    const onPath = executable(join(root, "bin", "mise"));

    expect(resolveMiseBinary({ env: { PATH: `${join(root, "empty")}:${join(root, "bin")}` }, locations: [] })).toBe(
      onPath,
    );
  });

  it("falls back to the usual locations", () => {
    const usual = executable(join(root, "homebrew", "mise"));

    expect(resolveMiseBinary({ env: { PATH: "" }, locations: [join(root, "missing", "mise"), usual] })).toBe(usual);
  });

  it("returns nothing, without an error, when no place holds an executable", () => {
    expect(resolveMiseBinary({ env: { PATH: join(root, "bin") }, locations: [join(root, "none")] })).toBeUndefined();
  });

  it("fails naming the setting and the path for a bad editor path", () => {
    executable(join(root, "bin", "mise"));

    expect(() =>
      resolveMiseBinary({ configured: join(root, "nope"), env: { PATH: join(root, "bin") }, locations: [] }),
    ).toThrow(new RegExp(`variant\\.mise\\.binPath setting.*${join(root, "nope")}`));
  });

  it("fails naming the key and the resolved path for a bad configuration key", () => {
    expect(() => resolveMiseBinary({ fromConfig: "./missing", configDir: root, env: { PATH: "" } })).toThrow(
      new RegExp(`variant\\.mise\\.binPath in variants\\.yaml.*${join(root, "missing")}`),
    );
  });

  it("refuses a path that is a file without execute permission", () => {
    const plain = join(root, "plain");
    writeFileSync(plain, "x");
    chmodSync(plain, 0o644);

    expect(() => resolveMiseBinary({ configured: plain, env: { PATH: "" } })).toThrow(plain);
  });

  it("lists the places it searches, for the message when mise is missing", () => {
    const places = miseSearchPlaces({ env: { PATH: "/a:/b" }, home: "/home/me", platform: "linux" });

    expect(places).toContain("/a/mise");
    expect(places).toContain("/opt/homebrew/bin/mise");
    expect(places).toContain("/home/me/.local/bin/mise");
    expect(places).toContain("/home/me/.local/share/mise/bin/mise");
    expect(places).toContain("/home/me/.cargo/bin/mise");
  });
});

describe("variant.mise.binPath in variants.yaml", () => {
  it("is accepted and carried on the resolved configuration", () => {
    writeFileSync(join(root, "variants.yaml"), "variant:\n  mise:\n    binPath: /opt/homebrew/bin/mise\n");

    expect(loadConfig({ cwd: root, environment: () => ({}) }).variant.mise?.binPath).toBe("/opt/homebrew/bin/mise");
  });

  it("is refused when empty", () => {
    writeFileSync(join(root, "variants.yaml"), 'variant:\n  mise:\n    binPath: ""\n');

    expect(() => loadConfig({ cwd: root, environment: () => ({}) })).toThrow(/binPath/);
  });
});
