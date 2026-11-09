import { describe, expect, it } from "bun:test";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { contactTarget, QueryGuard } from "./db/failure.js";
import { MysqlAdapter } from "./db/mysql.js";
import { PostgresAdapter } from "./db/postgres.js";
import { createClient } from "./index.js";
import { type LogEvent, setLogSink } from "./log.js";

const target = {
  dialect: "postgres" as const,
  database: "app",
  host: "127.0.0.1",
  port: 5432,
};

const coded = (code: string, message = code): Error => Object.assign(new Error(message), { code });

const failedQuery = (cause: Error): Error =>
  Object.assign(new Error("Failed query: SELECT schema_name FROM information_schema.schemata\nparams:"), {
    query: "SELECT schema_name FROM information_schema.schemata",
    cause,
  });

const capture = async (run: () => Promise<void>): Promise<LogEvent[]> => {
  const events: LogEvent[] = [];
  setLogSink((event) => {
    events.push(event);
  });
  try {
    await run();
  } finally {
    setLogSink(undefined);
  }
  return events;
};

const expectContact = (events: LogEvent[], error: unknown, dialect: string, port: number): void => {
  const warnings = events.filter((event) => event.level === "warn");
  expect(warnings).toHaveLength(1);
  const message = warnings[0]?.message ?? "";
  expect(message).toContain(dialect);
  expect(message).toContain("app");
  expect(message).toContain("127.0.0.1");
  expect(message).toContain(`:${port}`);
  expect(message).not.toContain("SELECT");
  expect(message).not.toContain("Failed query");
  expect(message).not.toContain("s3cret");
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(message);
  expect(events.filter((event) => event.level === "error")).toEqual([]);
};

describe("database contact warning", () => {
  const causes = [
    ["refused connection", "ECONNREFUSED"],
    ["timeout", "ETIMEDOUT"],
    ["unknown host", "ENOTFOUND"],
    ["authentication failure", "28P01"],
    ["missing database", "3D000"],
  ] as const;

  for (const [name, code] of causes) {
    it(`warns once for a postgres ${name}`, async () => {
      const guard = new QueryGuard({ ...target });
      let thrown: unknown;
      const events = await capture(async () => {
        thrown = await guard.run(() => Promise.reject(failedQuery(coded(code)))).catch((error: unknown) => error);
      });
      expectContact(events, thrown, "postgres", 5432);
    });
  }

  it("warns for a mysql authentication failure and a missing database", async () => {
    const mysql = { dialect: "mysql" as const, database: "app", host: "127.0.0.1", port: 3306 };
    for (const code of ["ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"]) {
      const guard = new QueryGuard(mysql);
      let thrown: unknown;
      const events = await capture(async () => {
        thrown = await guard.run(() => Promise.reject(failedQuery(coded(code)))).catch((error: unknown) => error);
      });
      expectContact(events, thrown, "mysql", 3306);
    }
  });

  it("leaves a password out of the warning when the connection URL contains one", async () => {
    const parsed = contactTarget({
      dialect: "postgres",
      url: "postgres://appuser:s3cret-url@127.0.0.1:5432/app",
    });
    const guard = new QueryGuard(parsed);
    const driver = coded("ECONNREFUSED", "connect ECONNREFUSED postgres://appuser:s3cret-url@127.0.0.1:5432/app");
    let thrown: unknown;
    const events = await capture(async () => {
      thrown = await guard.run(() => Promise.reject(failedQuery(driver))).catch((error: unknown) => error);
    });
    expectContact(events, thrown, "postgres", 5432);
    expect(events.map((event) => event.message).join(" ")).not.toContain("s3cret-url");
    expect((thrown as Error).message).not.toContain("s3cret-url");
  });

  it("warns once when one adapter is asked twice", async () => {
    const guard = new QueryGuard({ ...target });
    let first: unknown;
    let second: unknown;
    const events = await capture(async () => {
      first = await guard
        .run(() => Promise.reject(failedQuery(coded("ECONNREFUSED"))))
        .catch((error: unknown) => error);
      second = await guard
        .run(() => Promise.reject(failedQuery(coded("ECONNREFUSED"))))
        .catch((error: unknown) => error);
    });
    expectContact(events, first, "postgres", 5432);
    expect((second as Error).message).toBe((first as Error).message);
  });

  it("warns from the postgres adapter when the port refuses the connection", async () => {
    const adapter = new PostgresAdapter({
      dialect: "postgres",
      host: "127.0.0.1",
      port: 1,
      database: "app",
      password: "s3cret-db",
    });
    let thrown: unknown;
    const events = await capture(async () => {
      try {
        thrown = await adapter.list().catch((error: unknown) => error);
      } finally {
        await adapter.close();
      }
    });
    expectContact(events, thrown, "postgres", 1);
  });

  it("warns from the mysql adapter when the port refuses the connection", async () => {
    const adapter = new MysqlAdapter({
      dialect: "mysql",
      host: "127.0.0.1",
      port: 1,
      database: "app",
      password: "s3cret-db",
    });
    let thrown: unknown;
    const events = await capture(async () => {
      try {
        thrown = await adapter.list().catch((error: unknown) => error);
      } finally {
        await adapter.close();
      }
    });
    expectContact(events, thrown, "mysql", 1);
  });

  it("does not warn when a sqlite file is missing", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-sqlite-missing-")));
    try {
      writeFileSync(join(directory, "variants.yaml"), "db:\n  dialect: sqlite\n");
      const client = createClient({
        config: loadConfig({ cwd: directory, env: {} }),
        cwd: directory,
        stateDir: join(directory, ".cache", "variants"),
        worktree: false,
      });
      const events = await capture(async () => {
        expect(await client.list()).toEqual([]);
      });
      expect(events.filter((event) => event.level === "warn")).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("statement at debug only", () => {
  it("logs the statement at debug and keeps it out of the failure text", async () => {
    const guard = new QueryGuard({ ...target });
    const error = failedQuery(coded("42P01", "relation does not exist"));
    let thrown: unknown;
    const events = await capture(async () => {
      thrown = await guard.run(() => Promise.reject(error)).catch((failure: unknown) => failure);
    });
    expect(
      events
        .filter((event) => event.level === "debug")
        .map((event) => event.message)
        .join(" "),
    ).toContain("SELECT schema_name FROM information_schema.schemata");
    const visible = events.filter((event) => event.level === "warn" || event.level === "error");
    expect(visible).toEqual([]);
    expect((thrown as Error).message).not.toContain("Failed query");
    expect((thrown as Error).message).not.toContain("SELECT");
    expect((thrown as Error).message).toContain("relation does not exist");
  });
});
