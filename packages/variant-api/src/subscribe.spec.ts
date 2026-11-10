import { describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { type FSWatcher, mkdirSync, mkdtempSync, realpathSync, rmSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import { createVariantClient } from "./index.js";
import { type LogEvent, setLogSink } from "./log.js";
import { MiseError } from "./mise.js";
import { createStateSubscriptions } from "./subscribe.js";
import type { VariantRecord, VariantUpdate } from "./types.js";

const record = (slug: string, extra: Partial<VariantRecord> = {}): VariantRecord => ({
  slug,
  target: slug,
  dialect: "sqlite",
  statePath: "",
  createdAt: "",
  exists: true,
  implodeClean: slug !== "main",
  ...extra,
});

/** Collects what a subscriber receives and lets a test wait for the delivery it expects. */
const collector = () => {
  const updates: VariantUpdate[] = [];
  const waiters: { matches: (update: VariantUpdate) => boolean; resolve: (update: VariantUpdate) => void }[] = [];
  return {
    updates,
    listener: (update: VariantUpdate): void => {
      updates.push(update);
      for (const waiter of [...waiters]) {
        if (waiter.matches(update)) {
          waiters.splice(waiters.indexOf(waiter), 1);
          waiter.resolve(update);
        }
      }
    },
    /** The first delivery, from now on or already received, that satisfies `matches`. */
    until: (matches: (update: VariantUpdate) => boolean, timeoutMs = 3000): Promise<VariantUpdate> =>
      new Promise((resolve, reject) => {
        const seen = updates.find(matches);
        if (seen) {
          resolve(seen);
          return;
        }
        const timer = setTimeout(
          () => reject(new Error(`no matching delivery in ${timeoutMs} ms; got ${JSON.stringify(updates)}`)),
          timeoutMs,
        );
        waiters.push({
          matches,
          resolve: (update) => {
            clearTimeout(timer);
            resolve(update);
          },
        });
      }),
  };
};

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const withProject = async (
  run: (context: {
    directory: string;
    put: (path: string, content: string) => void;
    client: ReturnType<typeof createVariantClient>;
  }) => Promise<void>,
  timings: { debounceMs?: number; livenessIntervalMs?: number } = {},
): Promise<void> => {
  const directory = realpathSync(mkdtempSync(join("/tmp", "variant-subscribe-")));
  const put = (path: string, content: string): void => {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  };
  try {
    put("variants.yaml", "db:\n  dialect: sqlite\n");
    put("_v-demo/variants.local.yaml", "runtime:\n  slug: demo\n");
    const client = createVariantClient({
      config: loadConfig({ cwd: directory, env: {} }),
      cwd: directory,
      stateDir: join(directory, ".cache", "variants"),
      worktree: false,
      subscription: timings,
    });
    await run({ directory, put, client });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const slugs = (update: VariantUpdate): string[] => update.records.map((variant) => variant.slug);

describe("client.subscribe", () => {
  it("delivers the current records once, right after subscribing", () =>
    withProject(async ({ client }) => {
      const received = collector();
      const unsubscribe = client.subscribe(received.listener);
      try {
        const first = await received.until(() => true);
        await pause(400);

        expect(slugs(first)).toEqual(["demo"]);
        expect(received.updates).toHaveLength(1);
      } finally {
        unsubscribe();
      }
    }));

  it("delivers demo, no orphan, and the contact warning when the database cannot be contacted", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-subscribe-contact-")));
    mkdirSync(join(directory, "_v-demo", ".cache", "variant"), { recursive: true });
    writeFileSync(
      join(directory, "variants.yaml"),
      "db:\n  dialect: postgres\n  host: 127.0.0.1\n  port: 1\n  database: app\n",
    );
    writeFileSync(join(directory, "_v-demo", ".cache", "variant", "state.yaml"), "slug: demo\n");
    const client = createVariantClient({
      config: loadConfig({ cwd: directory, env: {}, environment: () => ({}) }),
      cwd: directory,
      stateDir: join(directory, ".cache", "variants"),
      worktree: false,
      subscription: { debounceMs: 10, livenessIntervalMs: 60_000 },
    });
    const received = collector();
    const unsubscribe = client.subscribe(received.listener);
    try {
      const update = await received.until((candidate) => candidate.records.some((variant) => variant.slug === "demo"));
      expect(slugs(update)).not.toContain("orphan");
      expect(update.error).toBeUndefined();
      expect(update.warning).toContain("postgres");
      expect(update.warning).toContain("app");
      expect(update.warning).toContain("127.0.0.1");
      expect(update.warning).not.toContain("SELECT");
    } finally {
      unsubscribe();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("delivers a set in which demo watches after its runtime file is rewritten", () =>
    withProject(async ({ client, put }) => {
      const received = collector();
      const unsubscribe = client.subscribe(received.listener);
      try {
        await received.until(() => true);
        put("_v-demo/variants.local.yaml", "runtime:\n  slug: demo\n  mode: watch\n");

        const update = await received.until((candidate) =>
          candidate.records.some((variant) => variant.slug === "demo" && variant.mode === "watch"),
        );
        expect(update.error).toBeUndefined();
      } finally {
        unsubscribe();
      }
    }));

  it("delivers a set that includes a variant whose state file is added", () =>
    withProject(async ({ client, put }) => {
      const received = collector();
      const unsubscribe = client.subscribe(received.listener);
      try {
        await received.until(() => true);
        put(
          ".cache/variants/fresh.yaml",
          "slug: fresh\ntarget: fresh\ndialect: sqlite\nstatePath: ''\ncreatedAt: '2026-01-01T00:00:00.000Z'\n",
        );

        await received.until((update) => slugs(update).includes("fresh"));
      } finally {
        unsubscribe();
      }
    }));

  it("delivers a set for a worktree that appears after subscribing", () =>
    withProject(async ({ client, put }) => {
      const received = collector();
      const unsubscribe = client.subscribe(received.listener);
      try {
        await received.until(() => true);
        put("_v-late/variants.local.yaml", "runtime:\n  slug: late\n");
        await received.until((update) => slugs(update).includes("late"));

        put("_v-late/variants.local.yaml", "runtime:\n  slug: late\n  mode: up\n");
        // A busy suite can miss the watch event. The liveness poll is 5s, so wait past it.
        await received.until(
          (update) => update.records.some((variant) => variant.slug === "late" && variant.mode),
          8000,
        );
      } finally {
        unsubscribe();
      }
    }));

  it("marks a watch dead within the liveness interval after its process ends without down", () =>
    withProject(
      async ({ client, put }) => {
        const child = spawn("sleep", ["30"], { stdio: "ignore" });
        const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
        const received = collector();
        const unsubscribe = client.subscribe(received.listener);
        try {
          put(
            "_v-demo/variants.local.yaml",
            `runtime:\n  slug: demo\n  mode: watch\n  watches:\n    fe: { pid: ${child.pid} }\n`,
          );
          await received.until((update) => update.records.some((variant) => variant.watches?.fe?.alive === true));

          child.kill("SIGKILL");
          await exited;

          await received.until((update) => update.records.some((variant) => variant.watches?.fe?.alive === false));
        } finally {
          unsubscribe();
          child.kill("SIGKILL");
        }
      },
      { livenessIntervalMs: 100 },
    ));

  it("delivers one set for a burst of changes within 100 milliseconds", () =>
    withProject(async ({ client, put }) => {
      const received = collector();
      const unsubscribe = client.subscribe(received.listener);
      try {
        await received.until(() => true);
        put("_v-a/variants.local.yaml", "runtime:\n  slug: a\n");
        await pause(40);
        put("_v-b/variants.local.yaml", "runtime:\n  slug: b\n");
        await pause(40);
        put("_v-c/variants.local.yaml", "runtime:\n  slug: c\n");
        await pause(700);

        expect(received.updates).toHaveLength(2);
        expect(slugs(received.updates[1] as VariantUpdate)).toEqual(["a", "b", "c", "demo"]);
      } finally {
        unsubscribe();
      }
    }));

  it("delivers nothing after the subscription ended", () =>
    withProject(async ({ client, put }) => {
      const received = collector();
      const unsubscribe = client.subscribe(received.listener);
      await received.until(() => true);
      unsubscribe();

      put("_v-demo/variants.local.yaml", "runtime:\n  slug: demo\n  mode: watch\n");
      await pause(500);

      expect(received.updates).toHaveLength(1);
    }));
});

describe("state subscriptions", () => {
  const quick = { debounceMs: 10, livenessIntervalMs: 20 };

  it("ignores a change of uptimeSeconds alone", async () => {
    let uptime = 1;
    const subscriptions = createStateSubscriptions({
      ...quick,
      read: async () => [
        record("demo", {
          mode: "watch",
          uptimeSeconds: uptime,
          watches: { fe: { alive: true, uptimeSeconds: uptime } },
        }),
      ],
      targets: () => [],
    });
    const received = collector();
    const unsubscribe = subscriptions.subscribe(received.listener);
    try {
      await received.until(() => true);
      uptime = 2;
      await pause(150);
      uptime = 3;
      await pause(150);

      expect(received.updates).toHaveLength(1);
    } finally {
      unsubscribe();
    }
  });

  it("retries an unreachable database on a backoff that restarts after contact returns", async () => {
    let reachable = false;
    let reads = 0;
    const subscriptions = createStateSubscriptions({
      debounceMs: 5,
      livenessIntervalMs: 15,
      contactRetryMs: (attempt) => [40, 80, 160][Math.min(attempt, 2)] ?? 160,
      read: async () => {
        reads += 1;
        return reachable
          ? { records: [record("demo"), record("orphan")] }
          : { records: [record("demo")], warning: "Cannot contact postgres database app at 127.0.0.1:1" };
      },
      targets: () => [],
    });
    const events: LogEvent[] = [];
    setLogSink((event) => events.push(event));
    const received = collector();
    const unsubscribe = subscriptions.subscribe(received.listener);
    try {
      await received.until((update) => update.warning !== undefined);
      const afterFirst = reads;
      await pause(25);
      expect(reads).toBe(afterFirst);
      await pause(30);
      expect(reads).toBe(afterFirst + 1);

      reachable = true;
      await received.until((update) => update.warning === undefined && slugs(update).includes("orphan"));
      expect(events.filter((event) => event.message === "database contact restored")).toHaveLength(1);

      reachable = false;
      const seen = received.updates.length;
      await received.until((update) => update.warning !== undefined && received.updates.indexOf(update) >= seen);
      const atOutage = reads;
      await pause(55);
      expect(reads).toBe(atOutage + 1);
      expect(events.filter((event) => event.message === "database contact restored")).toHaveLength(1);
    } finally {
      setLogSink(undefined);
      unsubscribe();
    }
  });

  it("delivers partial records and the contact warning when the database is unreachable, then clears it", async () => {
    const warning = "Cannot contact postgres database app at 127.0.0.1:5432";
    let reachable = false;
    const subscriptions = createStateSubscriptions({
      ...quick,
      read: async () =>
        reachable ? { records: [record("demo"), record("orphan")] } : { records: [record("demo")], warning },
      targets: () => [],
    });
    const received = collector();
    const unsubscribe = subscriptions.subscribe(received.listener);
    try {
      const down = await received.until((update) => update.warning !== undefined);
      expect(slugs(down)).toEqual(["demo"]);
      expect(slugs(down)).not.toContain("orphan");
      expect(down.error).toBeUndefined();
      expect(down.warning).toBe(warning);

      reachable = true;
      const up = await received.until((update) => update.warning === undefined && slugs(update).includes("orphan"));
      expect(slugs(up)).toContain("demo");
      expect(up.error).toBeUndefined();
    } finally {
      unsubscribe();
    }
  });

  it("keeps the last set with an error when a read fails, and clears it on recovery", async () => {
    let failure: Error | undefined;
    const subscriptions = createStateSubscriptions({
      ...quick,
      read: async () => {
        if (failure) {
          throw failure;
        }
        return [record("demo")];
      },
      targets: () => [],
    });
    const received = collector();
    const unsubscribe = subscriptions.subscribe(received.listener);
    try {
      await received.until(() => true);
      failure = new Error("database unreachable");
      const failed = await received.until((update) => update.error !== undefined);
      expect(failed.error).toBe("database unreachable");
      expect(slugs(failed)).toEqual(["demo"]);

      failure = undefined;
      const recovered = await received.until(
        (update) => update.error === undefined && received.updates.indexOf(update) > received.updates.indexOf(failed),
      );
      expect(slugs(recovered)).toEqual(["demo"]);
    } finally {
      unsubscribe();
    }
  });

  it("tells a failure of Mise from any other and says whether trust would fix it", async () => {
    let failure: Error = new MiseError("/proj", "mise.toml is not trusted");
    const subscriptions = createStateSubscriptions({
      ...quick,
      read: async () => {
        throw failure;
      },
      targets: () => [],
    });
    const received = collector();
    const unsubscribe = subscriptions.subscribe(received.listener);
    try {
      const mise = await received.until((update) => update.error !== undefined);
      expect(mise.mise).toEqual({ directory: "/proj", detail: "mise.toml is not trusted", untrusted: true });

      failure = new Error("database unreachable");
      const other = await received.until((update) => update.error === "database unreachable");
      expect(other.mise).toBeUndefined();
    } finally {
      unsubscribe();
    }
  });

  it("stops delivering and releases its watchers and timer when the last subscriber leaves", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-subscribe-")));
    const open = new Set<FSWatcher>();
    let reads = 0;
    try {
      const subscriptions = createStateSubscriptions({
        ...quick,
        read: async () => {
          reads += 1;
          return [record("demo")];
        },
        targets: () => [{ path: directory }],
        watch: ((path: string, listener: Parameters<typeof watch>[1]) => {
          const watcher = watch(path, listener);
          open.add(watcher);
          const close = watcher.close.bind(watcher);
          watcher.close = () => {
            open.delete(watcher);
            close();
          };
          return watcher;
        }) as typeof watch,
      });
      const received = collector();
      const unsubscribe = subscriptions.subscribe(received.listener);
      await received.until(() => true);
      expect(open.size).toBe(1);

      unsubscribe();
      expect(open.size).toBe(0);
      const readsAtEnd = reads;
      writeFileSync(join(directory, "file"), "x");
      await pause(150);

      expect(reads).toBe(readsAtEnd);
      expect(received.updates).toHaveLength(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("shares one watcher per path between subscribers and delivers each change to both", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-subscribe-")));
    let opened = 0;
    let slugsNow = ["demo"];
    try {
      const subscriptions = createStateSubscriptions({
        ...quick,
        read: async () => slugsNow.map((slug) => record(slug)),
        targets: () => [{ path: directory }],
        watch: ((path: string, listener: Parameters<typeof watch>[1]) => {
          opened += 1;
          return watch(path, listener);
        }) as typeof watch,
      });
      const first = collector();
      const second = collector();
      const stopFirst = subscriptions.subscribe(first.listener);
      const stopSecond = subscriptions.subscribe(second.listener);
      try {
        await first.until(() => true);
        await second.until(() => true);

        slugsNow = ["demo", "other"];
        writeFileSync(join(directory, "file"), "x");

        await first.until((update) => slugs(update).includes("other"));
        await second.until((update) => slugs(update).includes("other"));
        expect(opened).toBe(1);
      } finally {
        stopFirst();
        stopSecond();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
