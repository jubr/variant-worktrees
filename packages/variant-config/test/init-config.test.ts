import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { detectConnection } from "../src/autodetect.js";
import { loadConfig } from "../src/index.js";
import { renderInitConfig } from "../src/init-config.js";
import { VariantsConfigSchema } from "../src/schema.js";

/**
 * Specification: openspec/specs/variant-api/init/spec.md (Init writes autodetected values, Secrets stay in the
 * environment, Script watches, Alternatives in same-line comments)
 */

let directory: string;

beforeEach(() => {
  directory = realpathSync(mkdtempSync(join("/tmp", "variant-init-config-")));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const put = (path: string, content = ""): void => {
  mkdirSync(dirname(join(directory, path)), { recursive: true });
  writeFileSync(join(directory, path), content);
};

const render = (environment: NodeJS.ProcessEnv = {}, sources: Record<string, string> = {}, prefix = "_v-") =>
  renderInitConfig(directory, { prefix, environment: () => environment, sources });

const parsed = (text: string): Record<string, any> => parseYaml(text) as Record<string, any>;

const POSTGRES = {
  POSTGRES_HOST: "db.local",
  POSTGRES_PORT: "5433",
  POSTGRES_USER: "app",
  POSTGRES_PASSWORD: "hunter2",
  POSTGRES_DB: "appdb",
};

describe("renderInitConfig", () => {
  it("writes Postgres host, port, user and password as references and the database name as text", () => {
    const { text } = render(POSTGRES, {
      POSTGRES_HOST: join(dirname(directory), "mise.local.toml"),
      POSTGRES_PORT: join(dirname(directory), "mise.local.toml"),
      POSTGRES_USER: join(dirname(directory), "mise.local.toml"),
      POSTGRES_PASSWORD: join(dirname(directory), "mise.local.toml"),
    });
    const db = parsed(text).db;

    expect(db).toMatchObject({
      dialect: "postgres",
      host: "${POSTGRES_HOST}",
      port: "${POSTGRES_PORT}",
      user: "${POSTGRES_USER}",
      password: "${POSTGRES_PASSWORD}",
      database: "appdb",
    });
    expect(text).toContain("host: ${POSTGRES_HOST} # from ../mise.local.toml");
    expect(text).toContain("port: ${POSTGRES_PORT} # from ../mise.local.toml");
    expect(text).toContain("user: ${POSTGRES_USER} # from ../mise.local.toml");
    expect(text).toContain("password: ${POSTGRES_PASSWORD} # from ../mise.local.toml");
    expect(parsed(text).variant.main).toBeUndefined();
    expect(parsed(text).variant.root).toBeUndefined();
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("db.local");
  });

  it("writes MariaDB as dialect mysql", () => {
    const { text } = render({ MARIADB_HOST: "maria", MARIADB_DATABASE: "shop" });

    expect(parsed(text).db).toMatchObject({ dialect: "mysql", host: "maria", database: "shop" });
  });

  it("writes only the sqlite dialect when nothing is detected", () => {
    const { text, detected } = render();

    expect(parsed(text).db).toEqual({ dialect: "sqlite" });
    expect(text).not.toContain("filename");
    expect(detected.databaseSource).toBe("default");
  });

  it("writes the prefix given and the abbreviation of the project directory", () => {
    const { text } = render({}, {}, "wt-");

    expect(parsed(text).variant.prefix).toBe("wt-");
    expect(parsed(text).variant.abbr).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("never writes the absolute main or root directory", () => {
    const { text } = render(POSTGRES);

    expect(text).not.toContain(directory);
    expect(parsed(text).variant.main).toBeUndefined();
    expect(parsed(text).variant.root).toBeUndefined();
  });

  describe("watches", () => {
    it("writes Vite and NestJS watches with kind, watch and url and without dir", () => {
      put("fe/vite.config.ts");
      put("be/nest-cli.json", "{}");

      const { text, detected } = render();

      const watches = parsed(text).variant.watches;
      expect(Object.keys(watches)).toEqual(["be", "fe"]);
      expect(watches.fe).toMatchObject({ kind: "vite", watch: expect.stringContaining("vite") });
      expect(watches.fe.url).toBe("http://${slug}.${abbr}.localhost:${port}");
      expect(watches.be.kind).toBe("nestjs");
      expect(watches.be.url).toBeUndefined();
      expect(watches.fe.dir).toBeUndefined();
      expect(watches.be.dir).toBeUndefined();
      expect(detected.watches).toEqual(["be", "fe"]);
    });

    it("writes dir where it differs from the key", () => {
      put("a/web/vite.config.ts");
      put("b/web/vite.config.ts");

      const watches = parsed(render().text).variant.watches;

      expect(watches.web.dir).toBe("a/web");
      expect(watches["web-2"].dir).toBe("b/web");
    });

    it("writes a script watch without kind", () => {
      put("api/package.json", JSON.stringify({ scripts: { build: "tsc", watch: "tsc -w" } }));

      const watches = parsed(render().text).variant.watches;

      expect(watches.api).toEqual({ watch: "npm run watch" });
    });

    it("writes the project directory as app with dir .", () => {
      put("package.json", JSON.stringify({ scripts: { watch: "x" } }));

      const watches = parsed(render().text).variant.watches;

      expect(watches.app).toEqual({ dir: ".", watch: "npm run watch" });
    });

    it("writes no watches key when none is detected", () => {
      expect(parsed(render().text).variant.watches).toBeUndefined();
    });
  });

  describe("secrets", () => {
    it("names the mise file of a password relative to the variants.yaml", () => {
      const { text } = render(POSTGRES, { POSTGRES_PASSWORD: join(dirname(directory), "mise.local.toml") });

      expect(text).toContain("password: ${POSTGRES_PASSWORD} # from ../mise.local.toml");
    });

    it("names the environment when no file is listed for the variable", () => {
      expect(render(POSTGRES).text).toContain("password: ${POSTGRES_PASSWORD} # from the environment");
    });

    it("writes a URL with credentials as a reference and no part of the secret", () => {
      const { text } = render({ DATABASE_URL: "postgres://app:secret@localhost/app" });

      expect(text).toContain("url: ${DATABASE_URL} # from the environment");
      expect(text).not.toContain("secret");
    });

    it("writes a URL without credentials as it is", () => {
      const { text } = render({ DATABASE_URL: "postgres://localhost/app" });

      expect(parsed(text).db.url).toBe("postgres://localhost/app");
    });
  });

  describe("alternatives", () => {
    it("lists the other dialects, the other kinds and the other boolean after the value", () => {
      put("fe/vite.config.ts");
      put("be/nest-cli.json", "{}");

      const { text } = render({ ...POSTGRES, POSTGRES_SSL: "true" });

      expect(text).toMatch(/^ {2}dialect: postgres # sqlite \| mysql$/m);
      expect(text).toMatch(/^ {6}kind: vite # nestjs$/m);
      expect(text).toMatch(/^ {6}kind: nestjs # vite$/m);
      expect(text).toMatch(/^ {2}ssl: true # false$/m);
    });

    it("states the constraint of abbr and prefix", () => {
      const { text } = render();

      expect(text).toMatch(/^ {2}abbr: \S+ # .+$/m);
      expect(text).toMatch(/^ {2}prefix: _v- # .+$/m);
    });

    it("keeps comments inert: every commented value parses as the value before the #", () => {
      put("fe/vite.config.ts");

      const { text } = render({ ...POSTGRES, POSTGRES_SSL: "false" });

      expect(parsed(text).db.dialect).toBe("postgres");
      expect(parsed(text).db.ssl).toBe(false);
      expect(parsed(text).variant.watches.fe.kind).toBe("vite");
    });
  });

  describe("round trip", () => {
    it("passes validation and loads to the autodetected database, secrets resolved from the same environment", () => {
      put("fe/vite.config.ts");
      put("be/nest-cli.json", "{}");
      put("api/package.json", JSON.stringify({ scripts: { watch: "x" } }));
      const environment = { ...POSTGRES, POSTGRES_SCHEMA: "app", POSTGRES_SSL: "true" };
      const { text } = render(environment);
      put("variants.yaml", text);

      expect(VariantsConfigSchema.safeParse(parseYaml(text)).success).toBe(true);
      const config = loadConfig({ cwd: directory, environment: () => environment });
      expect(config.db).toEqual(detectConnection(directory, () => environment).config);
      expect(config.variant.main).toBe(directory);
      expect(config.variant.root).toBe(directory);
      expect(Object.keys(config.variant.watches)).toEqual(["api", "be", "fe"]);
    });

    it("loads a database-less file to a SQLite database", () => {
      put("variants.yaml", render().text);

      expect(loadConfig({ cwd: directory, environment: () => ({}) }).db.dialect).toBe("sqlite");
    });

    it("renders the example project to a loadable file", () => {
      const example = fileURLToPath(new URL("../../../example/", import.meta.url));
      cpSync(example, directory, {
        recursive: true,
        filter: (source) => !/(^|\/)(node_modules|dist|variants\.yaml)(\/|$)/.test(source.slice(example.length)),
      });

      const { text } = render();
      put("variants.yaml", text);

      expect(VariantsConfigSchema.safeParse(parseYaml(text)).success).toBe(true);
      const watches = loadConfig({ cwd: directory, environment: () => ({}) }).variant.watches;
      expect(watches.fe?.kind).toBe("vite");
      expect(watches.be?.kind).toBe("nestjs");
    });
  });
});
