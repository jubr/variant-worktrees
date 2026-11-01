import { describe, expect, it } from "bun:test";
import type { ReceivedAction } from "./memory-transport.js";
import type { Variant } from "./model.js";
import {
  attachWebviewHost,
  createWebviewTransport,
  type HostMessage,
  type MessagePort,
  type WebviewMessage,
} from "./protocol.js";
import { describeTransportContract } from "./testing/index.js";

/** Two ends of a channel that delivers each message on a later tick, as an editor does. */
const channel = (): {
  webview: MessagePort<WebviewMessage, HostMessage>;
  host: MessagePort<HostMessage, WebviewMessage>;
} => {
  const toHost = new Set<(message: WebviewMessage) => void>();
  const toWebview = new Set<(message: HostMessage) => void>();
  const deliver = <T>(handlers: Set<(message: T) => void>, message: T): void =>
    queueMicrotask(() => {
      for (const handler of [...handlers]) {
        handler(message);
      }
    });
  return {
    webview: {
      post: (message) => deliver(toHost, message),
      listen: (handler) => {
        toWebview.add(handler);
        return () => toWebview.delete(handler);
      },
    },
    host: {
      post: (message) => deliver(toWebview, message),
      listen: (handler) => {
        toHost.add(handler);
        return () => toHost.delete(handler);
      },
    },
  };
};

/** A record source a test drives, which delivers its latest records to each new subscriber. */
const source = (initial: Variant[]) => {
  let current = initial;
  let failure: string | undefined;
  const subscribers = new Set<(update: { records: Variant[]; error?: string }) => void>();
  const send = (): void => {
    for (const subscriber of [...subscribers]) {
      subscriber(failure === undefined ? { records: current } : { records: current, error: failure });
    }
  };
  return {
    subscribers,
    subscribe: (listener: (update: { records: Variant[]; error?: string }) => void) => {
      subscribers.add(listener);
      listener(failure === undefined ? { records: current } : { records: current, error: failure });
      return () => subscribers.delete(listener);
    },
    publish: (records: Variant[]) => {
      current = records;
      send();
    },
    fail: (message: string | undefined) => {
      failure = message;
      send();
    },
  };
};

describeTransportContract("webview messages", async (initial) => {
  const ports = channel();
  const records = source(initial);
  const received: ReceivedAction[] = [];
  let failure: string | undefined;
  const host = attachWebviewHost(ports.host, records, async (request) => {
    received.push(request);
    if (failure !== undefined) {
      const message = failure;
      failure = undefined;
      throw new Error(message);
    }
  });
  const transport = createWebviewTransport(ports.webview);
  return {
    transport,
    publish: records.publish,
    disconnect: () => records.fail("lost"),
    reconnect: () => records.fail(undefined),
    received: () => received,
    failNext: (message) => {
      failure = message;
    },
    dispose: () => host.dispose(),
  };
});

describe("webview host", () => {
  it("subscribes when the webview is ready, not before", async () => {
    const ports = channel();
    const records = source([{ slug: "demo" }]);
    attachWebviewHost(ports.host, records, async () => {});
    expect(records.subscribers.size).toBe(0);

    createWebviewTransport(ports.webview);
    await Promise.resolve();

    expect(records.subscribers.size).toBe(1);
  });

  it("has one subscription again after the webview loads anew", async () => {
    const ports = channel();
    const records = source([]);
    attachWebviewHost(ports.host, records, async () => {});

    createWebviewTransport(ports.webview);
    createWebviewTransport(ports.webview);
    await Promise.resolve();

    expect(records.subscribers.size).toBe(1);
  });

  it("ends its subscription when disposed", async () => {
    const ports = channel();
    const records = source([]);
    const host = attachWebviewHost(ports.host, records, async () => {});
    createWebviewTransport(ports.webview);
    await Promise.resolve();

    host.dispose();

    expect(records.subscribers.size).toBe(0);
  });
});
