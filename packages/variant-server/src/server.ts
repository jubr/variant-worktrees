import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import type { VariantClient } from "variant-api";
import { linesFrom, readTail } from "./log-tail.js";
import { serveApp } from "./static.js";

/** What the server needs of the library: the records, their changes and the three actions. */
export type UiClient = Pick<VariantClient, "list" | "subscribe" | "watch" | "down" | "implode">;

export interface UiServerOptions {
  client: UiClient;
  /** The port to listen on; 0 picks a free one. */
  port: number;
  /** The project abbreviation: the server answers to `ui.<abbr>.localhost`. */
  abbr: string;
  /** The built variants app. */
  staticDir: string;
  /** The token of this run; a random one of 128 bits by default. */
  token?: string;
  /** How often an idle event stream gets a comment line; 15 seconds by default. */
  keepAliveMs?: number;
}

export interface UiServer {
  port: number;
  token: string;
  /** `http://ui.<abbr>.localhost:<port>`, without the token. */
  url: string;
  close(): Promise<void>;
}

type ActionName = "watch" | "down" | "implode";

const COOKIE = "variant_ui_token";

const same = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

const cookieToken = (request: IncomingMessage): string | undefined =>
  request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);

const empty = (response: ServerResponse, status: number, headers: Record<string, string> = {}): void => {
  response.writeHead(status, headers);
  response.end();
};

const eventStream = (client: UiClient, response: ServerResponse, keepAliveMs: number): void => {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  response.flushHeaders();
  const send = (event: string, data: unknown): void => {
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const unsubscribe = client.subscribe((update) => {
    if (update.error === undefined) {
      send("records", update.records);
    } else {
      send("error", { error: update.error });
    }
  });
  const keepAlive = setInterval(() => response.write(": keep-alive\n\n"), keepAliveMs);
  response.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
};

const MAX_BODY_BYTES = 64 * 1024;

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("The request body is too large");
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
};

export const startUiServer = async (options: UiServerOptions): Promise<UiServer> => {
  const token = options.token ?? randomBytes(24).toString("base64url");
  let port = 0;
  const hostAllowed = (host: string | undefined): boolean =>
    host !== undefined &&
    [`ui.${options.abbr}.localhost`, "localhost", "127.0.0.1"].some((name) => host === `${name}:${port}`);

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (!hostAllowed(request.headers.host)) {
      return empty(response, 421);
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    const queryToken = url.searchParams.get("token");
    const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? "")?.[1];
    const offered = bearer ?? cookieToken(request);
    if (offered === undefined || !same(offered, token)) {
      if (request.method === "GET" && queryToken !== null && same(queryToken, token)) {
        url.searchParams.delete("token");
        const rest = url.searchParams.toString();
        return empty(response, 302, {
          "set-cookie": `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`,
          location: `${url.pathname}${rest === "" ? "" : `?${rest}`}`,
          "cache-control": "no-store",
        });
      }
      return empty(response, 401);
    }

    if (request.method === "GET" && url.pathname === "/api/variants") {
      return sendJson(response, 200, await options.client.list());
    }
    if (request.method === "GET" && url.pathname === "/api/events") {
      return eventStream(options.client, response, options.keepAliveMs ?? 15000);
    }
    const log = request.method === "GET" ? /^\/api\/variants\/([^/]+)\/log$/.exec(url.pathname) : null;
    if (log) {
      const slug = decodeURIComponent(log[1] as string);
      const path = (await options.client.list()).find((variant) => variant.slug === slug)?.log;
      const tail = path === undefined ? undefined : readTail(path, linesFrom(url.searchParams.get("lines")));
      if (tail === undefined) {
        return empty(response, 404);
      }
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      return void response.end(tail);
    }
    const action =
      request.method === "POST" ? /^\/api\/variants\/([^/]+)\/(watch|down|implode)$/.exec(url.pathname) : null;
    if (action) {
      return runAction(request, response, decodeURIComponent(action[1] as string), action[2] as ActionName);
    }
    if ((request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/api/")) {
      return serveApp(response, resolve(options.staticDir), url.pathname, request.method === "HEAD");
    }
    return empty(response, 404);
  };

  const runAction = async (
    request: IncomingMessage,
    response: ServerResponse,
    slug: string,
    name: ActionName,
  ): Promise<void> => {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) {
      return empty(response, 415);
    }
    let body: unknown;
    try {
      const text = await readBody(request);
      body = text.trim() === "" ? {} : JSON.parse(text);
    } catch {
      return empty(response, 400);
    }
    // main is the project's own checkout: it is always there, with or without a record.
    if (slug !== "main" && !(await options.client.list()).some((variant) => variant.slug === slug)) {
      return empty(response, 404);
    }
    if (name === "implode" && (slug === "main" || (body as { confirm?: unknown } | null)?.confirm !== true)) {
      return empty(response, 400);
    }
    try {
      const quiet = { log: () => {} };
      const result =
        name === "watch"
          ? await options.client.watch(slug, { ...quiet, detach: true })
          : name === "down"
            ? await options.client.down(slug, quiet)
            : await options.client.implode(slug, quiet);
      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  };

  const server: Server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      if (!response.headersSent) {
        sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      } else {
        response.end();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  port = (server.address() as AddressInfo).port;

  return {
    port,
    token,
    url: `http://ui.${options.abbr}.localhost:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
};
