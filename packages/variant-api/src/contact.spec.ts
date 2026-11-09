import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { PostgresAdapter } from "./db/postgres.js";
import { createClient } from "./index.js";
import { type LogEvent, setLogSink } from "./log.js";

const YAML = "db:\n  dialect: postgres\n  host: 127.0.0.1\n  port: 1\n  database: app\n  password: s3cret-db\n";

const withUnreachable = async (
  run: (client: ReturnType<typeof createClient>, events: () => LogEvent[]) => Promise<void>,
  files: Record<string, string> = {},
  subscription?: { debounceMs?: number; livenessIntervalMs?: number; contactRetryMs?: (attempt: number) => number },
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-contact-")));
  const put = (path: string, content: string): void => {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  const events: LogEvent[] = [];
  setLogSink((event) => {
    events.push(event);
  });
  try {
    put("variants.yaml", YAML);
    for (const [path, content] of Object.entries(files)) {
      put(path, content);
    }
    const client = createClient({
      config: loadConfig({ cwd: directory, env: {}, environment: () => ({}) }),
      cwd: directory,
      stateDir: join(directory, ".cache", "variants"),
      worktree: false,
      ...(subscription === undefined ? {} : { subscription }),
    });
    await run(client, () => events);
  } finally {
    setLogSink(undefined);
    rmSync(directory, { recursive: true, force: true });
  }
};

const warning = (events: LogEvent[]): string => {
  const warnings = events.filter((event) => event.level === "warn");
  expect(warnings).toHaveLength(1);
  const message = warnings[0]?.message ?? "";
  expect(message).toContain("postgres");
  expect(message).toContain("app");
  expect(message).toContain("127.0.0.1");
  expect(message).toContain(":1");
  expect(message).not.toContain("SELECT");
  expect(message).not.toContain("s3cret");
  return message;
};

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("subscription contact retries", () => {
  it("lists and warns once, then stays quiet while it retries", () =>
    withUnreachable(
      async (client, events) => {
        const stop = client.subscribe(() => {});
        try {
          await pause(90);
        } finally {
          stop();
        }
        expect(events().filter((event) => event.level === "warn")).toHaveLength(1);
        expect(events().filter((event) => event.message === "list")).toHaveLength(0);
        expect(events().filter((event) => event.message === "listing variants")).toHaveLength(0);
        expect(events().filter((event) => event.message === "listed variants")).toHaveLength(0);
        expect(events().filter((event) => event.level === "debug").length).toBeLessThanOrEqual(2);
      },
      { "_v-demo/.cache/variant/state.yaml": "slug: demo\n" },
      { debounceMs: 5, livenessIntervalMs: 15, contactRetryMs: () => 20 },
    ));
});

describe("list while the database cannot be contacted", () => {
  it("returns the worktree variant and omits a schema-only variant", () =>
    withUnreachable(
      async (client, events) => {
        const slugs = (await client.list()).map((record) => record.slug);
        expect(slugs).toContain("demo");
        expect(slugs).not.toContain("orphan");
        warning(events());
      },
      { "_v-demo/.cache/variant/state.yaml": "slug: demo\n" },
    ));

  it("returns an empty list and warns when nothing is on disk", () =>
    withUnreachable(async (client, events) => {
      expect(await client.list()).toEqual([]);
      warning(events());
    }));
});

describe("mutations fail closed when the database cannot be contacted", () => {
  it("fails create with the contact warning and no SQL", () =>
    withUnreachable(async (client, events) => {
      const error = await client.create("demo").catch((failure: unknown) => failure);
      const message = warning(events());
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(message);
      expect((error as Error).message).not.toContain("SELECT");
    }));

  it("fails schema create, drop, and destroy with the contact warning", async () => {
    const adapter = new PostgresAdapter({
      dialect: "postgres",
      host: "127.0.0.1",
      port: 1,
      database: "app",
      password: "s3cret-db",
    });
    const events: LogEvent[] = [];
    setLogSink((event) => {
      events.push(event);
    });
    try {
      const created = await adapter.create("demo").catch((failure: unknown) => failure);
      const dropped = await adapter.dropSchema("v_demo").catch((failure: unknown) => failure);
      const destroyed = await adapter.destroy("demo").catch((failure: unknown) => failure);
      const message = warning(events);
      for (const error of [created, dropped, destroyed]) {
        expect((error as Error).message).toBe(message);
        expect((error as Error).message).not.toContain("SELECT");
      }
    } finally {
      setLogSink(undefined);
      await adapter.close();
    }
  });
});

describe("status while the database cannot be contacted", () => {
  it("returns the variant known from its state file", () =>
    withUnreachable(
      async (client) => {
        expect(await client.status("demo")).toMatchObject({ slug: "demo" });
      },
      { "_v-demo/.cache/variant/state.yaml": "slug: demo\n" },
    ));

  it("fails an unknown slug with the contact warning rather than calling it unknown", () =>
    withUnreachable(async (client, events) => {
      const error = await client.status("ghost").catch((failure: unknown) => failure);
      const message = warning(events());
      expect((error as Error).message).toBe(message);
      expect((error as Error).message).not.toContain("Unknown variant");
      expect((error as Error).message).not.toContain("SELECT");
    }));
});
