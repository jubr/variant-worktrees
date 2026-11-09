import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { augmentMiseConfig, MISE_TOOL } from "./mise-augment.js";
import { fakeMise } from "./test/mise-mock.js";

/** Specification: openspec/specs/tools/mise/spec.md (Augmenting the Mise configuration) */

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-augment-")));
  execFileSync("git", ["init", "-q", root]);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const write = (relative: string, content: string): string => {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
};

const read = (relative: string): string => readFileSync(join(root, relative), "utf8");

const listing = (...paths: string[]): string => JSON.stringify(paths.map((path) => ({ path })));

const run = (directory: string, ...paths: string[]) => {
  const mise = fakeMise(root, { configLs: listing(...paths) });
  return { mise, result: augmentMiseConfig({ directory, miseBinPath: mise.binary }) };
};

const ENTRY = `"${MISE_TOOL}" = "latest"`;

describe("augmentMiseConfig", () => {
  it("creates mise.toml with a tools table when no file is inside the checkout", () => {
    const { result } = run(root, "/elsewhere/.config/mise/config.toml");

    expect(result).toMatchObject({ status: "created", file: join(root, "mise.toml") });
    expect(read("mise.toml")).toBe(`[tools]\n${ENTRY}\n`);
  });

  it("adds the entry to an existing tools table and leaves every other line alone", () => {
    const original = '# my tools\n[tools]\nnode = "22"\n\n[env]\nFOO = "bar"\n';
    const file = write("mise.toml", original);

    const { result, mise } = run(root, file);

    expect(result).toMatchObject({ status: "added", file });
    expect(read("mise.toml")).toBe('# my tools\n[tools]\nnode = "22"\n' + `${ENTRY}\n\n[env]\nFOO = "bar"\n`);
    expect(mise.callsOf("config")).toEqual([`-C ${root} config ls --json`]);
  });

  it("changes the other official file name and creates no mise.toml", () => {
    const file = write(".config/mise.toml", '[tools]\nnode = "22"\n');

    const { result } = run(root, file);

    expect(result).toMatchObject({ status: "added", file });
    expect(read(".config/mise.toml")).toContain(ENTRY);
    expect(() => readFileSync(join(root, "mise.toml"))).toThrow();
  });

  it("drops files with .local. in the name", () => {
    const local = write("mise.local.toml", "[tools]\n");
    const shared = write("mise.toml", "[tools]\n");

    const { result } = run(root, local, shared);

    expect(result.file).toBe(shared);
    expect(read("mise.local.toml")).toBe("[tools]\n");
    expect(read("mise.toml")).toContain(ENTRY);
  });

  it("takes the closest file when run in a subdirectory", () => {
    const app = write("app/mise.toml", "[tools]\n");
    const top = write("mise.toml", "[tools]\n");

    const { result } = run(join(root, "app"), app, top);

    expect(result.file).toBe(app);
    expect(read("mise.toml")).toBe("[tools]\n");
  });

  it("uses the mise.toml of the checkout root for a directory without configuration", () => {
    mkdirSync(join(root, "app"));
    const top = write("mise.toml", "[tools]\n");

    const { result } = run(join(root, "app"), top);

    expect(result.file).toBe(top);
    expect(read("mise.toml")).toContain(ENTRY);
  });

  it("ignores the global file and files above the checkout and creates mise.toml", () => {
    const inner = join(root, "inner");
    mkdirSync(inner);
    const parent = dirname(root);

    const { result } = run(root, join(parent, ".mise.toml"), "/home/user/.config/mise/config.toml");

    expect(result).toMatchObject({ status: "created", file: join(root, "mise.toml") });
  });

  it("appends a tools table when the file has none", () => {
    const file = write("mise.toml", '[env]\nFOO = "bar"\n');

    const { result } = run(root, file);

    expect(result.status).toBe("added");
    expect(read("mise.toml")).toBe(`[env]\nFOO = "bar"\n\n[tools]\n${ENTRY}\n`);
  });

  it("appends a tools table next to tools sub-tables", () => {
    const file = write("mise.toml", '[tools.node]\nversion = "22"\n');

    const { result } = run(root, file);

    expect(result.status).toBe("added");
    expect(read("mise.toml")).toBe(`[tools.node]\nversion = "22"\n\n[tools]\n${ENTRY}\n`);
  });

  it("changes nothing when the tool is already listed and says so", () => {
    const original = `[tools]\n"${MISE_TOOL}" = "1.2.3"\n`;
    const file = write("mise.toml", original);

    const { result } = run(root, file);

    expect(result).toMatchObject({ status: "unchanged", file });
    expect(result.message).toContain("already");
    expect(read("mise.toml")).toBe(original);
  });

  it("changes nothing when another file of the checkout already lists the tool", () => {
    const app = write("app/mise.toml", "[tools]\n");
    const top = write("mise.toml", `[tools]\n"${MISE_TOOL}" = "latest"\n`);

    const { result } = run(join(root, "app"), app, top);

    expect(result).toMatchObject({ status: "unchanged", file: top });
    expect(read("app/mise.toml")).toBe("[tools]\n");
  });

  it("leaves a file that is not valid TOML unchanged and names the problem", () => {
    const file = write("mise.toml", "[tools\nnode = \n");

    const { result } = run(root, file);

    expect(result).toMatchObject({ status: "failed", file });
    expect(result.message).toContain("not valid TOML");
    expect(read("mise.toml")).toBe("[tools\nnode = \n");
  });

  it("leaves a file unchanged when tools is an inline table", () => {
    const original = 'tools = { node = "22" }\n';
    const file = write("mise.toml", original);

    const { result } = run(root, file);

    expect(result).toMatchObject({ status: "failed", file });
    expect(result.message).toContain("tools");
    expect(read("mise.toml")).toBe(original);
  });

  it("keeps CRLF line endings", () => {
    const file = write("mise.toml", '[tools]\r\nnode = "22"\r\n');

    run(root, file);

    expect(read("mise.toml")).toBe(`[tools]\r\nnode = "22"\r\n${ENTRY}\r\n`);
  });

  it("works outside a git checkout with the directory itself as the boundary", () => {
    const outside = realpathSync(mkdtempSync(join("/tmp", "variant-augment-plain-")));
    try {
      const file = join(outside, "mise.toml");
      writeFileSync(file, "[tools]\n");
      const mise = fakeMise(outside, { configLs: listing(file, join(dirname(outside), "mise.toml")) });

      const result = augmentMiseConfig({ directory: outside, miseBinPath: mise.binary });

      expect(result.file).toBe(file);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("reports Mise not found with the places searched and the setting", () => {
    const result = augmentMiseConfig({
      directory: root,
      search: { env: { PATH: "/nowhere/bin" }, home: "/nohome", locations: ["/nowhere/usual/mise"] },
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("Mise was not found");
    expect(result.message).toContain("/nowhere/bin/mise");
    expect(result.message).toContain("/nowhere/usual/mise");
    expect(result.message).toContain("variant.mise.binPath");
    expect(() => readFileSync(join(root, "mise.toml"))).toThrow();
  });

  it("reports a failing Mise without changing anything", () => {
    const mise = fakeMise(root, { configLs: "not json" });

    const result = augmentMiseConfig({ directory: root, miseBinPath: mise.binary });

    expect(result.status).toBe("failed");
    expect(() => readFileSync(join(root, "mise.toml"))).toThrow();
  });
});
