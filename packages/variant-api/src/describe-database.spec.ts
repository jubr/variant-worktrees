import { describe, expect, it } from "bun:test";
import { describeDatabase } from "./describe-database.js";

/** Specification: openspec/specs/variant-api/core/spec.md (Variant records name their database) */
describe("describeDatabase", () => {
  it("shows a relative SQLite file relative, with ${slug} replaced", () => {
    expect(describeDatabase({ dialect: "sqlite" }, "demo")).toBe(".cache/variants/demo.sqlite");
    expect(describeDatabase({ dialect: "sqlite", database: "data/${slug}/app.sqlite" }, "demo")).toBe(
      "data/demo/app.sqlite",
    );
    expect(describeDatabase({ dialect: "sqlite", database: "abc.sqlite" }, "demo")).toBe("abc.sqlite");
  });

  it("shows an absolute SQLite file absolute", () => {
    expect(describeDatabase({ dialect: "sqlite", database: "/srv/db/${slug}.sqlite" }, "demo")).toBe(
      "/srv/db/demo.sqlite",
    );
  });

  it("builds a postgres:// URL from the fields, with *** for the password", () => {
    const database = describeDatabase(
      { dialect: "postgres", host: "db.example", port: 5432, user: "app", password: "secret", database: "appdb" },
      "demo",
    );

    expect(database).toBe("postgres://app:***@db.example:5432/appdb");
    expect(database).not.toContain("secret");
  });

  it("leaves out what is not configured and keeps the user without a password", () => {
    expect(describeDatabase({ dialect: "postgres", host: "db.example", user: "app", database: "appdb" }, "demo")).toBe(
      "postgres://app@db.example/appdb",
    );
    expect(describeDatabase({ dialect: "mysql", host: "localhost", port: "3306", database: "shop" }, "demo")).toBe(
      "mysql://localhost:3306/shop",
    );
  });

  it("builds a mysql:// URL for MySQL and MariaDB", () => {
    expect(
      describeDatabase({ dialect: "mysql", host: "maria", user: "u", password: "p", database: "shop" }, "demo"),
    ).toBe("mysql://u:***@maria/shop");
  });

  it("takes db.url and replaces only the password", () => {
    const database = describeDatabase(
      { dialect: "mysql", url: "mysql://app:secret@db.example/appdb?ssl=true" },
      "demo",
    );

    expect(database).toBe("mysql://app:***@db.example/appdb?ssl=true");
    expect(database).not.toContain("secret");
  });

  it("keeps a URL without a password as written and hides a password parameter", () => {
    expect(describeDatabase({ dialect: "postgres", url: "postgres://app@db.example:5433/appdb" }, "demo")).toBe(
      "postgres://app@db.example:5433/appdb",
    );
    expect(describeDatabase({ dialect: "postgres", url: "postgres://db.example/appdb?password=secret" }, "demo")).toBe(
      "postgres://db.example/appdb?password=***",
    );
  });

  it("hides the password of a URL that cannot be parsed", () => {
    const database = describeDatabase({ dialect: "postgres", url: "postgres://app:se cret@@db/appdb" }, "demo");

    expect(database).not.toContain("cret");
  });
});
