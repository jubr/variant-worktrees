import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createVariantClient } from "./index.js";
import { loadVariantConfig, MiseError, miseEnvironment, readVariableSources, runMiseTrust } from "./mise.js";
import { fakeMise } from "./test/mise-mock.js";

/** Specification: openspec/specs/tools/mise/spec.md */

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-mise-")));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("miseEnvironment", () => {
  it("starts no process until the environment is read, then one for any number of reads", () => {
    const mise = fakeMise(root, { env: "POSTGRES_HOST=db\nJWT_SECRET=s\n" });
    const environment = miseEnvironment({ directory: root, binary: mise.binary, base: {} });

    expect(mise.calls()).toEqual([]);
    expect(environment().POSTGRES_HOST).toBe("db");
    expect(environment().JWT_SECRET).toBe("s");
    expect(mise.callsOf("env")).toEqual([`-C ${root} env --dotenv --quiet`]);
  });

  it("lets a Mise value win over the process environment and keeps the rest of it", () => {
    const mise = fakeMise(root, { env: "POSTGRES_HOST=from-mise\n" });

    const environment = miseEnvironment({
      directory: root,
      binary: mise.binary,
      base: { POSTGRES_HOST: "from-process", OTHER: "kept" },
    })();

    expect(environment).toMatchObject({ POSTGRES_HOST: "from-mise", OTHER: "kept" });
  });

  it("uses the process environment alone when no Mise executable is found", () => {
    const environment = miseEnvironment({ directory: root, binary: undefined, base: { POSTGRES_HOST: "h" } })();

    expect(environment).toEqual({ POSTGRES_HOST: "h" });
  });

  it("fails with a Mise error naming the directory and carrying Mise's message", () => {
    const mise = fakeMise(root, { envFailure: "mise ERROR invalid TOML at line 3\n" });

    const failure = (() => {
      try {
        miseEnvironment({ directory: root, binary: mise.binary, base: {} })();
      } catch (error) {
        return error;
      }
    })();

    expect(failure).toBeInstanceOf(MiseError);
    expect((failure as MiseError).directory).toBe(root);
    expect((failure as MiseError).message).toContain(root);
    expect((failure as MiseError).message).toContain("invalid TOML at line 3");
    expect((failure as MiseError).untrusted).toBe(false);
  });

  it("marks the error untrusted when Mise says the configuration is not trusted", () => {
    const mise = fakeMise(root, {
      envFailure: `mise ERROR Config files in ${root}/mise.toml are not trusted. Trust them with \`mise trust\`.\n`,
    });

    const run = (): unknown => miseEnvironment({ directory: root, binary: mise.binary, base: {} })();

    expect(run).toThrow(MiseError);
    try {
      run();
    } catch (error) {
      expect((error as MiseError).untrusted).toBe(true);
      expect((error as MiseError).directory).toBe(root);
    }
  });
});

describe("readVariableSources", () => {
  it("maps each variable to its source file with ~ expanded", () => {
    const mise = fakeMise(root, {
      set: [
        "POSTGRES_PASSWORD  s3                  ~/proj/mise.local.toml",
        "POSTGRES_HOST      db local            /abs/mise.toml",
        "MULTI              first               ~/proj/mise.toml",
        "   second line",
        "",
      ].join("\n"),
    });

    const sources = readVariableSources({ directory: root, binary: mise.binary, home: "/home/me" });

    expect(sources).toEqual({
      POSTGRES_PASSWORD: "/home/me/proj/mise.local.toml",
      POSTGRES_HOST: "/abs/mise.toml",
      MULTI: "/home/me/proj/mise.toml",
    });
    expect(mise.callsOf("set")).toEqual([`-C ${root} set --raw --quiet`]);
  });

  it("lists nothing for a variable that Mise does not list", () => {
    const mise = fakeMise(root, { set: "A  1  /x/mise.toml\n" });

    expect(readVariableSources({ directory: root, binary: mise.binary, home: "/h" }).DATABASE_URL).toBeUndefined();
  });

  it("is empty without a Mise executable", () => {
    expect(readVariableSources({ directory: root, binary: undefined, home: "/h" })).toEqual({});
  });
});

describe("loadVariantConfig", () => {
  it("runs Mise once for db, references and steps, and not at all for a configuration that needs none", () => {
    const mise = fakeMise(root, { env: "POSTGRES_HOST=db\nPOSTGRES_PASSWORD=s3\nJWT_SECRET=jwt\n" });
    writeFileSync(
      join(root, "variants.yaml"),
      "db:\n  dialect: postgres\n  host: ${POSTGRES_HOST}\n  password: ${POSTGRES_PASSWORD}\nvariant:\n  seed: echo ${JWT_SECRET}\n",
    );

    const config = loadVariantConfig({ cwd: root, miseBinPath: mise.binary });
    expect(mise.calls()).toEqual([]);
    expect(config.db).toMatchObject({ dialect: "postgres", host: "db", password: "s3" });
    expect(config.environment().JWT_SECRET).toBe("jwt");
    expect(mise.callsOf("env")).toHaveLength(1);
  });

  it("takes the executable from variant.mise.binPath of the file when the caller passes none", () => {
    const mise = fakeMise(root, { env: "POSTGRES_HOST=from-key\n" });
    writeFileSync(join(root, "variants.yaml"), `variant:\n  mise:\n    binPath: ${mise.binary}\n`);

    expect(loadVariantConfig({ cwd: root }).db.host).toBe("from-key");
  });

  it("prefers the executable the caller passes over the key", () => {
    const mise = fakeMise(root, { env: "POSTGRES_HOST=from-editor\n" });
    writeFileSync(join(root, "variants.yaml"), "variant:\n  mise:\n    binPath: /does/not/exist\n");

    expect(loadVariantConfig({ cwd: root, miseBinPath: mise.binary }).db.host).toBe("from-editor");
  });

  it("fails naming the setting when the executable the caller passes does not exist", () => {
    writeFileSync(join(root, "variants.yaml"), "variant:\n  prefix: wt-\n");
    const config = loadVariantConfig({ cwd: root, miseBinPath: join(root, "missing") });

    expect(() => config.db).toThrow(/variant\.mise\.binPath setting/);
  });
});

describe("runMiseTrust", () => {
  it("runs mise trust --all in the directory", () => {
    const mise = fakeMise(root);

    runMiseTrust({ directory: root, binary: mise.binary });

    expect(mise.callsOf("trust")).toEqual([`-C ${root} trust --all`]);
  });

  it("fails with a Mise error carrying the message when trust fails", () => {
    const mise = fakeMise(root, { trustFailure: "mise ERROR cannot write trust file\n" });

    expect(() => runMiseTrust({ directory: root, binary: mise.binary })).toThrow(/cannot write trust file/);
  });
});

describe("createVariantClient laziness", () => {
  it("starts no Mise process for list when the database is an explicit SQLite one", async () => {
    const mise = fakeMise(root, { env: "POSTGRES_HOST=db\n" });
    writeFileSync(join(root, "variants.yaml"), "db:\n  dialect: sqlite\n");
    const client = createVariantClient({ cwd: root, miseBinPath: mise.binary, worktree: false });

    await client.list();

    expect(mise.calls()).toEqual([]);
  });

  it("reads the environment through Mise once when detection needs it", async () => {
    const mise = fakeMise(root, { env: "SQLITE_DATABASE=app\n" });
    writeFileSync(join(root, "variants.yaml"), "variant:\n  prefix: wt-\n");
    const client = createVariantClient({ cwd: root, miseBinPath: mise.binary, worktree: false });

    await client.list();
    await client.list();

    expect(mise.callsOf("env")).toHaveLength(1);
  });
});
