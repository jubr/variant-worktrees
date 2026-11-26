import { describe, expect, it } from "bun:test";
import { detectConnection } from "./autodetect.js";

describe("detectConnection", () => {
  it("reads PostgreSQL values from the environment provider", () => {
    const detected = detectConnection("/proj", () => ({
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: "5432",
      POSTGRES_USER: "variant",
      POSTGRES_PASSWORD: "secret",
      POSTGRES_DB: "variants",
      POSTGRES_SSL: "false",
    }));

    expect(detected.source).toBe("env");
    expect(detected.config).toMatchObject({
      dialect: "postgres",
      host: "127.0.0.1",
      port: 5432,
      user: "variant",
      password: "secret",
      database: "variants",
      ssl: false,
    });
  });

  it("falls back to one SQLite file per slug when nothing is set", () => {
    const detected = detectConnection("/proj", () => ({}));

    expect(detected.source).toBe("default");
    expect(detected.config).toEqual({ dialect: "sqlite", database: ".cache/variants/{slug}.sqlite" });
  });
});

/** Specification: openspec/specs/variant-config/core/spec.md (SQLite database file) */
describe("detectConnection for SQLite", () => {
  it("reads SQLITE_DATABASE and SQLITE_PATH as the database file, the first one winning", () => {
    expect(detectConnection("/proj", () => ({ SQLITE_DATABASE: "a.sqlite" })).config).toEqual(
      expect.objectContaining({ dialect: "sqlite", database: "a.sqlite" }),
    );
    expect(detectConnection("/proj", () => ({ SQLITE_PATH: "/data/b.sqlite" })).config).toEqual(
      expect.objectContaining({ dialect: "sqlite", database: "/data/b.sqlite" }),
    );
    const both = detectConnection("/proj", () => ({ SQLITE_DATABASE: "a.sqlite", SQLITE_PATH: "/x.sqlite" }));
    expect(both.config.database).toBe("a.sqlite");
    expect(both.config).not.toHaveProperty("filename");
  });

  it("reads the file of a sqlite: DATABASE_URL", () => {
    const file = (url: string) => detectConnection("/proj", () => ({ DATABASE_URL: url })).config.database;
    expect(file("sqlite:///var/data/app.sqlite")).toBe("/var/data/app.sqlite");
    expect(file("sqlite:app.sqlite")).toBe("app.sqlite");
    expect(file("sqlite:./data/app.sqlite")).toBe("./data/app.sqlite");
    expect(file("sqlite://data/app.sqlite")).toBe("data/app.sqlite");
  });

  it("lets a variable win over the DATABASE_URL file and names the variable that gave the file", () => {
    const { config, variables } = detectConnection("/proj", () => ({
      DATABASE_URL: "sqlite:///url.sqlite",
      SQLITE_DATABASE: "var.sqlite",
    }));
    expect(config.database).toBe("var.sqlite");
    expect(variables.database).toBe("SQLITE_DATABASE");
    expect(detectConnection("/proj", () => ({ DATABASE_URL: "sqlite:url.sqlite" })).variables.database).toBe(
      "DATABASE_URL",
    );
  });
});

/** Specification: openspec/specs/variant-config/core/spec.md (MariaDB detection) */
describe("detectConnection for MariaDB", () => {
  it("detects a mariadb:// URL as the mysql dialect and keeps the URL", () => {
    const { config } = detectConnection("/proj", () => ({ DATABASE_URL: "mariadb://app@localhost/app" }));

    expect(config).toMatchObject({ dialect: "mysql", url: "mariadb://app@localhost/app" });
  });

  it("reads MARIADB_ variables like their MYSQL_ counterparts", () => {
    const { config } = detectConnection("/proj", () => ({
      MARIADB_HOST: "maria.local",
      MARIADB_PORT: "3307",
      MARIADB_USER: "app",
      MARIADB_PASSWORD: "pw",
      MARIADB_DATABASE: "shop",
    }));

    expect(config).toMatchObject({
      dialect: "mysql",
      host: "maria.local",
      port: 3307,
      user: "app",
      password: "pw",
      database: "shop",
    });
  });

  it("lets a MYSQL_ variable win over the MARIADB_ one of the same setting", () => {
    const { config } = detectConnection("/proj", () => ({ MYSQL_HOST: "a", MARIADB_HOST: "b", MARIADB_USER: "u" }));

    expect(config).toMatchObject({ host: "a", user: "u" });
  });

  it("detects Postgres before MySQL and MariaDB, and those before SQLite", () => {
    expect(
      detectConnection("/proj", () => ({ POSTGRES_HOST: "p", MARIADB_HOST: "m", SQLITE_DATABASE: "s" })).config.dialect,
    ).toBe("postgres");
    expect(detectConnection("/proj", () => ({ MARIADB_HOST: "m", SQLITE_DATABASE: "s" })).config.dialect).toBe("mysql");
  });
});

/** Specification: openspec/specs/variant-api/init/spec.md (Secrets stay in the environment) */
describe("detectConnection variables", () => {
  it("names the variable that supplied each field", () => {
    const { variables } = detectConnection("/proj", () => ({
      DATABASE_URL: "postgres://localhost/app",
      POSTGRES_HOST: "h",
      POSTGRES_PORT: "5432",
      POSTGRES_USER: "u",
      POSTGRES_PASSWORD: "p",
      POSTGRES_DB: "d",
      POSTGRES_SCHEMA: "s",
      POSTGRES_SSL: "true",
    }));

    expect(variables).toEqual({
      url: "DATABASE_URL",
      host: "POSTGRES_HOST",
      port: "POSTGRES_PORT",
      user: "POSTGRES_USER",
      password: "POSTGRES_PASSWORD",
      database: "POSTGRES_DB",
      schema: "POSTGRES_SCHEMA",
      ssl: "POSTGRES_SSL",
    });
  });

  it("names the MariaDB and SQLite variables, and prefers MYSQL_ over MARIADB_", () => {
    expect(
      detectConnection("/proj", () => ({ MYSQL_HOST: "a", MARIADB_HOST: "b", MARIADB_PASSWORD: "p" })).variables,
    ).toEqual({ host: "MYSQL_HOST", password: "MARIADB_PASSWORD" });
    expect(detectConnection("/proj", () => ({ SQLITE_DATABASE: "a", SQLITE_PATH: "/x.db" })).variables).toEqual({
      database: "SQLITE_DATABASE",
    });
    expect(detectConnection("/proj", () => ({ SQLITE_PATH: "/x.db" })).variables).toEqual({ database: "SQLITE_PATH" });
  });

  it("names nothing when nothing is detected", () => {
    expect(detectConnection("/proj", () => ({})).variables).toEqual({});
  });
});
