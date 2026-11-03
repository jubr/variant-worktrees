import { describe, expect, it } from "bun:test";
import { detectConnection } from "../src/autodetect.js";

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

  it("falls back to a SQLite file in the directory when nothing is set", () => {
    const detected = detectConnection("/proj", () => ({}));

    expect(detected.source).toBe("default");
    expect(detected.config).toEqual({ dialect: "sqlite", filename: "/proj/.cache/variants/variants.db" });
  });
});
