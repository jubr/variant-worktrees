import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHttpTransport } from "variant-ui";
import { describeTransportContract } from "variant-ui/testing";
import { startUiServer } from "./index.js";
import { fakeClient, record } from "./test-support.js";

const staticDir = (): string => {
  const directory = mkdtempSync(join("/tmp", "variant-http-transport-"));
  mkdirSync(join(directory, "app"));
  writeFileSync(join(directory, "app", "index.html"), "<!doctype html>");
  return directory;
};

describeTransportContract("http, against the real server", async (initial) => {
  const directory = staticDir();
  const logFile = join(directory, "demo.log");
  writeFileSync(logFile, "line 1\n");
  // The contract names a log path of its own; here it has to be a file the server can read.
  const records = initial.map((variant) => ({
    ...record(variant.slug),
    ...variant,
    ...(variant.log ? { log: logFile } : {}),
  }));
  const client = fakeClient(records);
  const token = "contract-token";
  const start = (port: number) => startUiServer({ client, port, abbr: "vw", staticDir: join(directory, "app"), token });
  let server = await start(0);
  const { port } = server;
  const logFetches: string[] = [];
  const transport = createHttpTransport({
    baseUrl: `http://127.0.0.1:${port}`,
    headers: { authorization: `Bearer ${token}` },
    backoff: { initialMs: 20, maxMs: 50 },
    fetch: (input, init) => {
      const url = String(input);
      const slug = /\/api\/variants\/([^/]+)\/log/.exec(url)?.[1];
      if (slug) {
        logFetches.push(slug);
      }
      return fetch(input, init);
    },
  });
  return {
    transport,
    publish: (next) => {
      client.records = next.map((variant) => ({ ...record(variant.slug), ...variant }));
      client.publish({ records: client.records });
    },
    disconnect: async () => {
      await server.close();
    },
    reconnect: async () => {
      server = await start(port);
    },
    received: () => [
      ...client.calls.map((call) => {
        const [action, slug] = call.split(" ") as ["watch" | "down" | "implode", string];
        return action === "implode" ? { action, slug, confirm: true } : { action, slug };
      }),
      ...logFetches.map((slug) => ({ action: "showOutput" as const, slug })),
    ],
    failNext: client.failNext,
    dispose: async () => {
      transport.close();
      await server.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
});
