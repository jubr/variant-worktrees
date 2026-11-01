import { describe, expect, it } from "bun:test";
import type { ReceivedAction } from "../memory-transport.js";
import type { Variant } from "../model.js";
import type { Transport } from "../transport.js";

/** The side of a transport under test that plays the host: it changes state and records what the app asked for. */
export interface TransportHarness {
  transport: Transport;
  /** The host has a new set of records. */
  publish(records: Variant[]): void;
  /** The connection to the host is lost. */
  disconnect(): Promise<void> | void;
  /** The connection returns, and the host's current records are delivered. */
  reconnect(): Promise<void> | void;
  /** What the host has been asked to do, in order. */
  received(): ReceivedAction[];
  /** The next action fails at the host with this message. */
  failNext(message: string): void;
  dispose(): Promise<void> | void;
}

const eventually = async (condition: () => boolean, what: string, timeoutMs = 3000): Promise<void> => {
  for (const deadline = Date.now() + timeoutMs; !condition(); await new Promise((r) => setTimeout(r, 10))) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${what}`);
    }
  }
};

const demo = (extra: Partial<Variant> = {}): Variant => ({ slug: "demo", ...extra });

/**
 * The behaviour every transport shares, so the app runs unchanged over each of them. `create` returns a connected
 * transport whose host holds `initial`.
 */
export const describeTransportContract = (
  name: string,
  create: (initial: Variant[]) => Promise<TransportHarness>,
): void => {
  const using = async (initial: Variant[], body: (harness: TransportHarness) => Promise<void>): Promise<void> => {
    const harness = await create(initial);
    try {
      await body(harness);
    } finally {
      await harness.dispose();
    }
  };

  describe(`transport contract: ${name}`, () => {
    it("starts connected with the records of the host", () =>
      using([demo(), { slug: "main" }], async ({ transport }) => {
        await eventually(() => transport.state() === "connected", "connected");
        await eventually(() => transport.records().length === 2, "the first records");

        expect(transport.records().map((variant) => variant.slug)).toEqual(["demo", "main"]);
      }));

    it("keeps the same records array until the set changes", () =>
      using([demo()], async ({ transport }) => {
        await eventually(() => transport.records().length === 1, "the first records");

        expect(transport.records()).toBe(transport.records());
      }));

    it("tells subscribers about a new set of records", () =>
      using([demo()], async ({ transport, publish }) => {
        await eventually(() => transport.records().length === 1, "the first records");
        let calls = 0;
        const unsubscribe = transport.subscribe(() => {
          calls += 1;
        });

        publish([demo({ mode: "watch" })]);
        await eventually(() => transport.records()[0]?.mode === "watch", "the new set");

        expect(calls).toBeGreaterThan(0);
        unsubscribe();
      }));

    it("stops telling a subscriber that unsubscribed", () =>
      using([demo()], async ({ transport, publish }) => {
        await eventually(() => transport.records().length === 1, "the first records");
        let calls = 0;
        const unsubscribe = transport.subscribe(() => {
          calls += 1;
        });
        unsubscribe();

        publish([demo({ mode: "watch" })]);
        await eventually(() => transport.records()[0]?.mode === "watch", "the new set");

        expect(calls).toBe(0);
      }));

    it("reports disconnected, keeps the last records, and replaces them on reconnect", () =>
      using([demo()], async ({ transport, publish, disconnect, reconnect }) => {
        await eventually(() => transport.records().length === 1, "the first records");

        await disconnect();
        await eventually(() => transport.state() === "disconnected", "disconnected");
        expect(transport.records().map((variant) => variant.slug)).toEqual(["demo"]);

        publish([demo(), { slug: "other" }]);
        await reconnect();
        await eventually(() => transport.state() === "connected", "connected again");
        await eventually(() => transport.records().length === 2, "the current set");

        expect(transport.records().map((variant) => variant.slug)).toEqual(["demo", "other"]);
      }));

    it("passes watch, down, implode and showOutput to the host with the slug", () =>
      using([demo({ log: "/work/_v-demo/variants.watch.log" })], async ({ transport, received }) => {
        await eventually(() => transport.records().length === 1, "the first records");

        await transport.watch("demo");
        await transport.down("demo");
        await transport.implode("demo", true);
        await transport.showOutput("demo");

        expect(received()).toEqual([
          { action: "watch", slug: "demo" },
          { action: "down", slug: "demo" },
          { action: "implode", slug: "demo", confirm: true },
          { action: "showOutput", slug: "demo" },
        ]);
      }));

    it("rejects an action with the message the host failed with", () =>
      using([demo()], async ({ transport, failNext }) => {
        await eventually(() => transport.records().length === 1, "the first records");
        failNext("Variant demo is not merged into main");

        await expect(transport.implode("demo", true)).rejects.toThrow("Variant demo is not merged into main");
      }));
  });
};
