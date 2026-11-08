import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log, setLogSink } from "variant-api";
import { schemaHeaderFor } from "variant-config";
import { attachLogLevel, formatLogEvent } from "../src/log-level.ts";
import { runCli, withVariants } from "./support/cli.js";

const CLEAN_DB = {
  DATABASE_URL: "",
  POSTGRES_HOST: "",
  POSTGRES_PORT: "",
  POSTGRES_USER: "",
  POSTGRES_PASSWORD: "",
  POSTGRES_DB: "",
  POSTGRES_SCHEMA: "",
  MYSQL_HOST: "",
  MYSQL_PORT: "",
  MYSQL_USER: "",
  MYSQL_PASSWORD: "",
  MYSQL_DATABASE: "",
  MYSQL_SCHEMA: "",
  MARIADB_HOST: "",
  MARIADB_PORT: "",
  MARIADB_USER: "",
  MARIADB_PASSWORD: "",
  MARIADB_DATABASE: "",
  SQLITE_DATABASE: "",
  SQLITE_PATH: "",
};

/** A project whose PostgreSQL server refuses connections, with variant `demo` on disk. */
const withUnreachable = async (run: (environment: Record<string, string>) => Promise<void>): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-log-level-")));
  try {
    const yaml = `${schemaHeaderFor("variants.yaml")}\n\ndb:\n  dialect: postgres\n  host: 127.0.0.1\n  port: 1\n  database: app\n  password: s3cret-db\n`;
    mkdirSync(join(directory, "_v-demo", ".cache", "variant"), { recursive: true });
    writeFileSync(join(directory, "variants.yaml"), yaml);
    writeFileSync(join(directory, "_v-demo", ".cache", "variant", "state.yaml"), "slug: demo\n");
    await run({ ...CLEAN_DB, VARIANT_CONFIG: join(directory, "variants.yaml") });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe("log level flag", () => {
  it("prints the contact warning on stderr and keeps it off stdout", () =>
    withUnreachable(async (environment) => {
      const result = await runCli(["list"], environment);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toMatch(/^\[warn\]/m);
      expect(result.stderr).toContain("postgres");
      expect(result.stderr).toContain("app");
      expect(result.stderr).not.toContain("SELECT");
      expect(result.stderr).not.toContain("s3cret");
      expect(result.stdout).toContain("demo");
      expect(result.stdout).not.toContain("warning:");
      expect(result.stdout).not.toContain("Cannot contact");
    }));

  it("hides the warning at error and still exits 0", () =>
    withUnreachable(async (environment) => {
      const result = await runCli(["list", "--log-level=error"], environment);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toContain("Cannot contact");
      expect(result.stdout).toContain("demo");
    }));

  it("prints trace lines when the threshold is trace", () =>
    withVariants(async (environment) => {
      const result = await runCli(["list", "--log-level=trace"], environment);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toMatch(/^\[trace\]/m);
    }));

  it("selects debug when the flag comes before the command name", () =>
    withVariants(async (environment) => {
      const result = await runCli(["--log-level=debug", "list"], environment);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toMatch(/^\[debug\]/m);
      expect(result.stderr).not.toMatch(/^\[trace\]/m);
    }));

  it("treats warning as warn", () =>
    withUnreachable(async (environment) => {
      const result = await runCli(["list", "--log-level=warning"], environment);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toMatch(/^\[warn\]/m);
      expect(result.stderr).not.toMatch(/^\[debug\]/m);
    }));

  it("rejects an unknown level without running the command", () =>
    withVariants(async (environment) => {
      const result = await runCli(["list", "--log-level=loud"], environment);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("--log-level");
      expect(result.stderr).toContain("trace");
      expect(result.stderr).toContain("debug");
      expect(result.stderr).toContain("info");
      expect(result.stderr).toContain("warn");
      expect(result.stderr).toContain("error");
      expect(result.stderr).toContain("warning");
      expect(result.stdout).not.toContain("alpha");
    }));

  it("prints a mise command at info without the slug", () => {
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    attachLogLevel("info");
    try {
      log("info", "+ mise install", { step: "create", slug: "add-auth" });
      log("debug", "+ mise trust --all", { step: "create", slug: "add-auth" });
    } finally {
      setLogSink(undefined);
      process.stderr.write = write;
    }
    expect(lines).toEqual(["[info] create + mise install\n"]);
    expect(lines.join("")).not.toContain("add-auth");
  });

  it("prints the message after the level when the event has no step", () => {
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    attachLogLevel("info");
    try {
      log("info", "listed variants");
    } finally {
      setLogSink(undefined);
      process.stderr.write = write;
    }
    expect(lines).toEqual(["[info] listed variants\n"]);
  });

  it("does not treat brackets in the message as a step", () => {
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    attachLogLevel("info");
    try {
      log("info", "[provision] create schema app");
    } finally {
      setLogSink(undefined);
      process.stderr.write = write;
    }
    expect(lines).toEqual(["[info] [provision] create schema app\n"]);
  });
});

const ESC = "\u001b";

describe("log line color", () => {
  const event = { level: "info" as const, message: "+ mise install", step: "create", slug: "add-auth" };

  it("colors the brackets, the level word, and the step on a terminal", () => {
    expect(formatLogEvent(event, { isTTY: true })).toBe(
      `${ESC}[90m[${ESC}[32minfo${ESC}[90m]${ESC}[0m ${ESC}[36mcreate${ESC}[0m + mise install\n`,
    );
  });

  it("uses the level color for trace, debug, warn, and error", () => {
    const colored = (level: "trace" | "debug" | "warn" | "error"): string =>
      formatLogEvent({ level, message: "x" }, { isTTY: true });
    expect(colored("trace")).toContain(`${ESC}[38;5;67mtrace`);
    expect(colored("debug")).toContain(`${ESC}[33mdebug`);
    expect(colored("warn")).toContain(`${ESC}[38;5;208mwarn`);
    expect(colored("error")).toContain(`${ESC}[31merror`);
  });

  it("prints a plain warn line when stderr is not a terminal or NO_COLOR is set", () => {
    const warn = { level: "warn" as const, message: "database down" };
    for (const output of [{ isTTY: false }, { isTTY: true, NO_COLOR: "1" }, { isTTY: true, NO_COLOR: "" }]) {
      const line = formatLogEvent(warn, output);
      expect(line.startsWith("[warn]")).toBe(true);
      expect(line).toContain("database down");
      expect(line).not.toContain(ESC);
    }
  });
});

describe("verbose is not a log level", () => {
  it("keeps the verbose listing and does not print debug lines", () =>
    withVariants(async (environment) => {
      const result = await runCli(["list", "-v"], environment);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("runtime:");
      expect(result.stderr).not.toMatch(/^\[debug\]/m);
    }));
});
