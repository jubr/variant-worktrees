import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { type IncomingHttpHeaders, request } from "node:http";
import { join } from "node:path";
import type { VariantRecord, VariantUpdate } from "variant-api";
import { startUiServer, type UiClient, type UiServer } from "./index.js";

export const record = (slug: string, extra: Partial<VariantRecord> = {}): VariantRecord => ({
  slug,
  target: slug,
  dialect: "sqlite",
  statePath: "",
  createdAt: "",
  exists: true,
  ...extra,
});

export interface FakeClient extends UiClient {
  /** Every action the server asked for, in order, as `name slug`. */
  calls: string[];
  /** The options of every `watch` the server asked for. */
  watchOptions: unknown[];
  /** The records `list` and new subscribers get. */
  records: VariantRecord[];
  /** Delivers a set to every subscriber, like the state subscription does. */
  publish(update: VariantUpdate): void;
  /** The next action throws this message. */
  failNext(message: string): void;
  subscribers(): number;
}

/** A client whose store is a list of records and whose actions only record that they were asked for. */
export const fakeClient = (records: VariantRecord[] = []): FakeClient => {
  const listeners = new Set<(update: VariantUpdate) => void>();
  let failure: string | undefined;
  const fake: FakeClient = {
    calls: [],
    watchOptions: [],
    records,
    publish: (update) => {
      for (const listener of [...listeners]) {
        listener(update);
      }
    },
    failNext: (message) => {
      failure = message;
    },
    subscribers: () => listeners.size,
    list: async () => fake.records,
    subscribe: (listener) => {
      listeners.add(listener);
      queueMicrotask(() => listener({ records: fake.records }));
      return () => listeners.delete(listener);
    },
    watch: async (slug, watchOptions) => {
      fake.watchOptions.push(watchOptions);
      return act("watch", slug);
    },
    down: async (slug) => act("down", slug),
    implode: async (slug) => act("implode", slug),
  } as FakeClient;
  const act = async (name: string, slug: string | undefined): Promise<never> => {
    fake.calls.push(`${name} ${slug}`);
    if (failure !== undefined) {
      const message = failure;
      failure = undefined;
      throw new Error(message);
    }
    return { slug } as never;
  };
  return fake;
};

export interface ServerEvent {
  /** `message` unless the stream named it. */
  event: string;
  data: string;
}

export interface EventStream {
  /** Everything received so far: events, and `: comment` lines as `{ event: ":", data: <comment> }`. */
  events: ServerEvent[];
  status: number;
  headers: IncomingHttpHeaders;
  /** The first event, received now or later, that satisfies `matches`. */
  until: (matches: (event: ServerEvent) => boolean, timeoutMs?: number) => Promise<ServerEvent>;
  close: () => void;
}

/** Opens `/api/events` and parses the stream. */
export const openEvents = (
  port: number,
  token: string,
  path = "/api/events",
  headers: Record<string, string> = {},
): Promise<EventStream> =>
  new Promise((resolve, reject) => {
    const events: ServerEvent[] = [];
    const waiters: { matches: (event: ServerEvent) => boolean; resolve: (event: ServerEvent) => void }[] = [];
    const outgoing = request(
      { host: "127.0.0.1", port, path, headers: { authorization: `Bearer ${token}`, ...headers } },
      (response) => {
        let buffer = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          buffer += chunk;
          for (let end = buffer.indexOf("\n\n"); end !== -1; end = buffer.indexOf("\n\n")) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const parsed: ServerEvent = { event: "message", data: "" };
            for (const line of block.split("\n")) {
              if (line.startsWith(":")) {
                parsed.event = ":";
                parsed.data = line.slice(1).trim();
              } else if (line.startsWith("event:")) {
                parsed.event = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                parsed.data += line.slice(5).trim();
              }
            }
            events.push(parsed);
            for (const waiter of [...waiters]) {
              if (waiter.matches(parsed)) {
                waiters.splice(waiters.indexOf(waiter), 1);
                waiter.resolve(parsed);
              }
            }
          }
        });
        resolve({
          events,
          status: response.statusCode ?? 0,
          headers: response.headers,
          until: (matches, timeoutMs = 3000) =>
            new Promise((done, fail) => {
              const seen = events.find(matches);
              if (seen) {
                done(seen);
                return;
              }
              const timer = setTimeout(
                () => fail(new Error(`no matching event in ${timeoutMs} ms; got ${JSON.stringify(events)}`)),
                timeoutMs,
              );
              waiters.push({
                matches,
                resolve: (event) => {
                  clearTimeout(timer);
                  done(event);
                },
              });
            }),
          close: () => outgoing.destroy(),
        });
      },
    );
    outgoing.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code !== "ECONNRESET") {
        reject(error);
      }
    });
    outgoing.end();
  });

export interface TestServer extends UiServer {
  directory: string;
  /** `http://127.0.0.1:<port>`: the address requests go to. */
  origin: string;
  client: FakeClient;
  /** A request with the token as a bearer header, unless `headers` says otherwise. */
  call: (
    method: string,
    path: string,
    options?: { headers?: Record<string, string | undefined>; body?: string; auth?: boolean },
  ) => Promise<{ status: number; headers: IncomingHttpHeaders; body: string }>;
}

/** Starts the server on a random port with a fake client and a static directory holding a tiny app. */
export const withServer = async (
  run: (server: TestServer) => Promise<void>,
  options: {
    records?: VariantRecord[] | ((directory: string) => VariantRecord[]);
    files?: Record<string, string>;
    abbr?: string;
    keepAliveMs?: number;
  } = {},
): Promise<void> => {
  const directory = mkdtempSync(join("/tmp", "variant-server-"));
  const staticDir = join(directory, "app");
  mkdirSync(staticDir, { recursive: true });
  writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>Variants</title>");
  for (const [path, content] of Object.entries(options.files ?? {})) {
    mkdirSync(join(directory, path, ".."), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  const given = options.records ?? [];
  const client = fakeClient(typeof given === "function" ? given(directory) : given);
  const server = await startUiServer({
    client,
    port: 0,
    abbr: options.abbr ?? "vw",
    staticDir,
    ...(options.keepAliveMs === undefined ? {} : { keepAliveMs: options.keepAliveMs }),
  });
  const origin = `http://127.0.0.1:${server.port}`;
  const call: TestServer["call"] = (method, path, callOptions = {}) =>
    new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (callOptions.auth !== false) {
        headers.authorization = `Bearer ${server.token}`;
      }
      for (const [name, value] of Object.entries(callOptions.headers ?? {})) {
        if (value === undefined) {
          delete headers[name.toLowerCase()];
        } else {
          headers[name.toLowerCase()] = value;
        }
      }
      const outgoing = request({ host: "127.0.0.1", port: server.port, method, path, headers }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      });
      outgoing.on("error", reject);
      outgoing.end(callOptions.body);
    });
  try {
    await run({ ...server, directory, origin, client, call });
  } finally {
    await server.close();
    rmSync(directory, { recursive: true, force: true });
  }
};
