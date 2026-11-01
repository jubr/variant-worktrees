import { describe, expect, it } from "bun:test";
import { openEvents, record, withServer } from "./test-support.js";

describe("snapshot", () => {
  it("returns the records `list` returns as JSON", () =>
    withServer(
      async ({ call }) => {
        const response = await call("GET", "/api/variants");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/json");
        expect(JSON.parse(response.body)).toEqual([
          record("main"),
          record("demo", { mode: "watch", url: "http://demo.vw.localhost:62060" }),
        ]);
      },
      { records: [record("main"), record("demo", { mode: "watch", url: "http://demo.vw.localhost:62060" })] },
    ));
});

describe("events", () => {
  it("starts with the current records", () =>
    withServer(
      async ({ port, token }) => {
        const stream = await openEvents(port, token);
        try {
          expect(stream.status).toBe(200);
          expect(stream.headers["content-type"]).toContain("text/event-stream");
          const first = await stream.until(() => true);

          expect(first.event).toBe("records");
          expect(JSON.parse(first.data).map((variant: { slug: string }) => variant.slug)).toEqual(["demo"]);
        } finally {
          stream.close();
        }
      },
      { records: [record("demo")] },
    ));

  it("sends a new event for every delivery of the state subscription", () =>
    withServer(
      async ({ port, token, client }) => {
        const stream = await openEvents(port, token);
        try {
          await stream.until(() => true);
          client.publish({ records: [record("demo", { mode: "watch" })] });

          const changed = await stream.until(
            (event) => event.event === "records" && JSON.parse(event.data)[0]?.mode === "watch",
          );
          expect(changed.event).toBe("records");
        } finally {
          stream.close();
        }
      },
      { records: [record("demo")] },
    ));

  it("sends a failed read as an error event and stays open", () =>
    withServer(
      async ({ port, token, client }) => {
        const stream = await openEvents(port, token);
        try {
          await stream.until(() => true);
          client.publish({ records: [record("demo")], error: "database unreachable" });

          const failure = await stream.until((event) => event.event === "error");
          expect(JSON.parse(failure.data)).toEqual({ error: "database unreachable" });

          client.publish({ records: [record("demo", { mode: "up" })] });
          await stream.until((event) => event.event === "records" && JSON.parse(event.data)[0]?.mode === "up");
        } finally {
          stream.close();
        }
      },
      { records: [record("demo")] },
    ));

  it("sends a comment line to keep the connection open", () =>
    withServer(
      async ({ port, token }) => {
        const stream = await openEvents(port, token);
        try {
          await stream.until((event) => event.event === ":");
        } finally {
          stream.close();
        }
      },
      { keepAliveMs: 50 },
    ));

  it("ends its subscription when the client goes away", () =>
    withServer(async ({ port, token, client }) => {
      const stream = await openEvents(port, token);
      await stream.until(() => true);
      expect(client.subscribers()).toBe(1);

      stream.close();
      for (let attempt = 0; attempt < 50 && client.subscribers() > 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      expect(client.subscribers()).toBe(0);
    }));

  it("requires the token", () =>
    withServer(async ({ call }) => {
      expect((await call("GET", "/api/events", { auth: false })).status).toBe(401);
    }));
});

describe("log tail", () => {
  const lines = (count: number): string => `${Array.from({ length: count }, (_, i) => `line ${i + 1}`).join("\n")}\n`;
  const withLog = (
    count: number,
    run: (call: (query: string) => Promise<{ status: number; body: string }>) => Promise<void>,
  ) =>
    withServer(async ({ call }) => run((query) => call("GET", `/api/variants/demo/log${query}`)), {
      files: { "work/demo.log": lines(count) },
      records: (directory) => [record("demo", { log: `${directory}/work/demo.log` })],
    });
  const bodyLines = (body: string): string[] => body.split("\n").filter((line) => line !== "");

  it("returns the last 200 lines of the variant's log as plain text by default", () =>
    withLog(500, async (tail) => {
      const response = await tail("");

      expect(response.status).toBe(200);
      expect(bodyLines(response.body)).toHaveLength(200);
      expect(bodyLines(response.body)[0]).toBe("line 301");
      expect(bodyLines(response.body).at(-1)).toBe("line 500");
    }));

  it("returns the last n lines for lines=n", () =>
    withLog(500, async (tail) => {
      const response = await tail("?lines=50");

      expect(bodyLines(response.body)).toHaveLength(50);
      expect(bodyLines(response.body)[0]).toBe("line 451");
    }));

  it("returns the whole log when it is shorter than asked", () =>
    withLog(3, async (tail) => {
      expect(bodyLines((await tail("?lines=50")).body)).toEqual(["line 1", "line 2", "line 3"]);
    }));

  it("caps lines at 2000 and falls back to the default for a value that is no positive integer", () =>
    withLog(2500, async (tail) => {
      expect(bodyLines((await tail("?lines=5000")).body)).toHaveLength(2000);
      expect(bodyLines((await tail("?lines=abc")).body)).toHaveLength(200);
      expect(bodyLines((await tail("?lines=0")).body)).toHaveLength(200);
    }));

  it("answers the content type text/plain", () =>
    withServer(
      async ({ call }) => {
        expect((await call("GET", "/api/variants/demo/log")).headers["content-type"]).toContain("text/plain");
      },
      {
        files: { "work/demo.log": "x\n" },
        records: (directory) => [record("demo", { log: `${directory}/work/demo.log` })],
      },
    ));

  it("answers 404 for a variant without a log, a log file that is gone, and an unknown variant", () =>
    withServer(
      async ({ call, directory }) => {
        expect((await call("GET", "/api/variants/demo/log")).status).toBe(404);
        expect((await call("GET", "/api/variants/gone/log")).status).toBe(404);
        expect((await call("GET", "/api/variants/nope/log")).status).toBe(404);
        expect(directory).toBeTruthy();
      },
      {
        records: (directory) => [record("demo"), record("gone", { log: `${directory}/work/missing.log` })],
      },
    ));
});
