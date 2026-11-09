import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as api from "./index.js";
import { getVariantsAdoption } from "./index.js";

/**
 * Specification: openspec/specs/variant-config/adoption/spec.md
 */

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join("/tmp", "variant-adoption-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

const put = (path: string, content = ""): void => {
  mkdirSync(dirname(join(directory, path)), { recursive: true });
  writeFileSync(join(directory, path), content);
};

const vite = (): void => {
  put("fe/vite.config.ts", "export default {};\n");
};

const calls = (): { environment: () => NodeJS.ProcessEnv; count: () => number } => {
  let reads = 0;
  return {
    environment: () => {
      reads += 1;
      return { POSTGRES_HOST: "h" };
    },
    count: () => reads,
  };
};

describe("getVariantsAdoption", () => {
  it("is active for variants.yaml and does not read the environment", () => {
    put("variants.yaml", "variant: {}\n");
    const env = calls();

    expect(getVariantsAdoption(directory, env.environment)).toEqual({ status: "active" });
    expect(env.count()).toBe(0);
  });

  it("is active for variants.yml when variants.yaml is absent", () => {
    put("variants.yml", "variant: {}\n");

    expect(getVariantsAdoption(directory, () => ({ POSTGRES_HOST: "h" }))).toEqual({ status: "active" });
  });

  it("is active when a parent directory contains variants.yaml", () => {
    put("variants.yaml", "variant: {}\n");
    const child = join(directory, "packages", "app");
    mkdirSync(child, { recursive: true });
    const env = calls();

    expect(getVariantsAdoption(child, env.environment)).toEqual({ status: "active" });
    expect(env.count()).toBe(0);
  });

  it("is detected as postgres+vite", () => {
    vite();

    expect(getVariantsAdoption(directory, () => ({ POSTGRES_HOST: "h" }))).toEqual({
      status: "detected",
      label: "postgres+vite",
    });
  });

  it("is detected as sqlite+package-script-watch", () => {
    put("api/package.json", JSON.stringify({ name: "x", scripts: { watch: "tsc -w" } }));

    expect(getVariantsAdoption(directory, () => ({ SQLITE_DATABASE: "x" }))).toEqual({
      status: "detected",
      label: "sqlite+package-script-watch",
    });
  });

  it("is detected as mariadb+nestjs", () => {
    put("be/nest-cli.json", "{}\n");

    expect(getVariantsAdoption(directory, () => ({ MARIADB_HOST: "h" }))).toEqual({
      status: "detected",
      label: "mariadb+nestjs",
    });
  });

  it("is detected as mysql+vite", () => {
    vite();

    expect(getVariantsAdoption(directory, () => ({ MYSQL_HOST: "h" }))).toEqual({
      status: "detected",
      label: "mysql+vite",
    });
  });

  it("joins every application kind after the database", () => {
    vite();
    put("be/nest-cli.json", "{}\n");
    put("lib/package.json", JSON.stringify({ name: "x", scripts: { watch: "tsc -w" } }));

    expect(getVariantsAdoption(directory, () => ({ POSTGRES_HOST: "h" }))).toEqual({
      status: "detected",
      label: "postgres+vite+nestjs+package-script-watch",
    });
  });

  it("is none when no database or no application is detected", () => {
    expect(getVariantsAdoption(directory, () => ({ POSTGRES_HOST: "h" }))).toEqual({ status: "none" });

    vite();
    expect(getVariantsAdoption(directory, () => ({}))).toEqual({ status: "none" });
  });

  it("is none and carries the failure when the environment cannot be read", () => {
    vite();
    const failure = new Error("mise failed");

    expect(
      getVariantsAdoption(directory, () => {
        throw failure;
      }),
    ).toEqual({ status: "none", error: failure });
  });

  it("exports getVariantsAdoption and not detectOnboarding", () => {
    expect(api.getVariantsAdoption).toBeFunction();
    expect("detectOnboarding" in api).toBe(false);
    expect("OnboardingDetection" in api).toBe(false);
  });
});
