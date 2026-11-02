import type { Variant } from "./model.js";
import type { ConnectionState, Transport } from "./transport.js";

export interface HttpTransportOptions {
  /** Where the server is; empty for the page's own origin. */
  baseUrl?: string;
  /** For a caller outside a browser, or one that needs to watch requests. */
  fetch?: typeof fetch;
  /** Extra request headers, for a caller that has no cookie. */
  headers?: Record<string, string>;
  /** The wait before the first reconnect, doubled up to `maxMs`. */
  backoff?: { initialMs?: number; maxMs?: number };
  /** The event stream counts as lost after this long without any data, keep-alive comments included. */
  idleTimeoutMs?: number;
  /** Receives the tail of a variant's log when the person asks to see its output. */
  onOutput?: (slug: string, text: string) => void;
}

export interface HttpTransport extends Transport {
  /** Ends the event stream and any reconnect. */
  close(): void;
}

interface ServerEvent {
  event: string;
  data: string;
}

/** Splits a server-sent event stream into its events; comment lines are dropped. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      buffer += decoder.decode(value, { stream: true }).replaceAll("\r\n", "\n");
      for (let end = buffer.indexOf("\n\n"); end !== -1; end = buffer.indexOf("\n\n")) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        let event = "message";
        const data: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) {
            event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            data.push(line.slice(5).replace(/^ /, ""));
          }
        }
        if (data.length > 0) {
          yield { event, data: data.join("\n") };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** The transport of the web page: the event stream for records, `fetch` for actions, reconnecting with backoff. */
export const createHttpTransport = (options: HttpTransportOptions = {}): HttpTransport => {
  const baseUrl = options.baseUrl ?? "";
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const initialMs = options.backoff?.initialMs ?? 500;
  const maxMs = options.backoff?.maxMs ?? 10000;
  const idleTimeoutMs = options.idleTimeoutMs ?? 45000;
  const headers = options.headers ?? {};
  const listeners = new Set<() => void>();
  let records: readonly Variant[] = [];
  let state: ConnectionState = "connecting";
  let closed = false;
  let abort: AbortController | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      listener();
    }
  };
  const setState = (next: ConnectionState): void => {
    if (state !== next) {
      state = next;
      notify();
    }
  };

  const connect = async (attempt: number): Promise<void> => {
    if (closed) {
      return;
    }
    abort = new AbortController();
    let idle: ReturnType<typeof setTimeout> | undefined;
    const armIdle = (): void => {
      clearTimeout(idle);
      idle = setTimeout(() => abort?.abort(), idleTimeoutMs);
    };
    let failures = attempt;
    try {
      armIdle();
      const response = await doFetch(`${baseUrl}/api/events`, {
        headers: { ...headers, accept: "text/event-stream" },
        signal: abort.signal,
      });
      if (!response.ok || response.body === null) {
        throw new Error(`The event stream answered ${response.status}`);
      }
      setState("connected");
      failures = 0;
      for await (const event of readEvents(response.body)) {
        armIdle();
        if (event.event === "records") {
          records = JSON.parse(event.data) as Variant[];
          notify();
        }
      }
    } catch {
      // The stream is lost or never came up; the retry below covers both.
    } finally {
      clearTimeout(idle);
    }
    if (closed) {
      return;
    }
    setState("disconnected");
    retry = setTimeout(() => void connect(failures + 1), Math.min(maxMs, initialMs * 2 ** failures));
  };

  const fail = async (response: Response): Promise<never> => {
    let message = `The server answered ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // No JSON body: keep the status.
    }
    throw new Error(message);
  };

  const post = async (slug: string, action: string, body: unknown): Promise<void> => {
    const response = await doFetch(`${baseUrl}/api/variants/${encodeURIComponent(slug)}/${action}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await fail(response);
    }
  };

  void connect(0);

  return {
    origin: "server",
    records: () => records,
    sort: () => "name-asc",
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    state: () => state,
    watch: (slug) => post(slug, "watch", {}),
    down: (slug) => post(slug, "down", {}),
    implode: (slug, confirm) => post(slug, "implode", { confirm }),
    showOutput: async (slug) => {
      const response = await doFetch(`${baseUrl}/api/variants/${encodeURIComponent(slug)}/log?lines=200`, { headers });
      if (!response.ok) {
        await fail(response);
      }
      options.onOutput?.(slug, await response.text());
    },
    close: () => {
      closed = true;
      clearTimeout(retry);
      abort?.abort();
    },
  };
};
