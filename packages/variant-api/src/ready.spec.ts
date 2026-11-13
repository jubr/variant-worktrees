import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "variant-config";
import type { OperationContext } from "./operations/types.js";
import { announce } from "./ready.js";
import type { VariantRun } from "./run-context.js";

/** Specification: openspec/specs/variant-api/runtime/spec.md */

const ESC = "\u001b";
const HEAD = `${ESC}[1;36m`;
const RESET = `${ESC}[0m`;
const COMMENT = `${ESC}[90m`;
const YELLOW = `${ESC}[33m`;
const key = (value: string): string => `${HEAD}${value}${RESET}`;
const word = (value: string): string => `${YELLOW}${value}${RESET}`;
const INTERACTIVE = `[watch] Interactive:   ${key("1")} ${word("restart")}   ${key("2")} ${word("detach")}   ${key("3")} ${word("quit")}   ${COMMENT}(press number + ⏎)${RESET}`;

const listen = (ready: () => boolean = () => true): Promise<{ port: number; close: () => void }> =>
  new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(ready() ? 200 : 503);
      response.end("ok");
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("no port"));
        return;
      }
      resolve({
        port: address.port,
        close: () => {
          server.close();
          server.closeAllConnections();
        },
      });
    });
  });

describe("watch interactive hint", () => {
  it("prints the colored hint after the URL 200 when the watch is on a terminal", async () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-ready-hint-"));
    const health = await listen();
    const previous = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: sqlite\nvariant:\n  watches:\n    be:\n      ready: /health\n",
      );
      const messages: string[] = [];
      const recorded: string[] = [];
      const url = `http://127.0.0.1:${health.port}/health`;

      await announce(
        { config: loadConfig({ cwd: directory, env: {} }) } as OperationContext,
        { urls: {}, ports: { be: health.port } } as VariantRun,
        {
          tty: true,
          opener: () => {},
          log: (line) => messages.push(line),
          record: (line) => recorded.push(line),
        },
      );

      const ready = messages.indexOf(`[watch] be URL 200 ${url}`);
      expect(ready).toBeGreaterThanOrEqual(0);
      expect(messages[ready + 1]).toBe(INTERACTIVE);
      expect(recorded).not.toContain(INTERACTIVE);
      expect(messages.filter((line) => line.includes("Interactive"))).toHaveLength(1);
    } finally {
      if (previous === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = previous;
      health.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("prints the hint after the last URL 200, when every ready watch is up", async () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-ready-last-"));
    const first = await listen();
    let feHits = 0;
    const second = await listen(() => {
      feHits += 1;
      return feHits > 1;
    });
    const previous = process.env.NO_COLOR;
    delete process.env.NO_COLOR;
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: sqlite\nvariant:\n  watches:\n    be:\n      ready: /health\n    fe:\n      ready: /health\n",
      );
      const messages: string[] = [];
      await announce(
        { config: loadConfig({ cwd: directory, env: {} }) } as OperationContext,
        { urls: {}, ports: { be: first.port, fe: second.port } } as VariantRun,
        { tty: true, opener: () => {}, log: (line) => messages.push(line) },
      );
      const be = messages.indexOf(`[watch] be URL 200 http://127.0.0.1:${first.port}/health`);
      const fe = messages.indexOf(`[watch] fe URL 200 http://127.0.0.1:${second.port}/health`);
      const hint = messages.indexOf(INTERACTIVE);
      expect(be).toBeGreaterThanOrEqual(0);
      expect(fe).toBeGreaterThan(be);
      expect(hint).toBe(fe + 1);
    } finally {
      if (previous === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = previous;
      first.close();
      second.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("skips the hint when the watch is not on a terminal", async () => {
    const directory = mkdtempSync(join(tmpdir(), "variant-ready-pipe-"));
    const health = await listen();
    try {
      writeFileSync(
        join(directory, "variants.yaml"),
        "db:\n  dialect: sqlite\nvariant:\n  watches:\n    be:\n      ready: /health\n",
      );
      const messages: string[] = [];

      await announce(
        { config: loadConfig({ cwd: directory, env: {} }) } as OperationContext,
        { urls: {}, ports: { be: health.port } } as VariantRun,
        { opener: () => {}, log: (line) => messages.push(line) },
      );

      expect(messages.some((line) => line.includes("URL 200"))).toBe(true);
      expect(messages.some((line) => line.includes("Interactive"))).toBe(false);
    } finally {
      health.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
