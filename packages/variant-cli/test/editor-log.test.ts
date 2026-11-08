import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { createServer, type Server, type Socket } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { log, setLogSink } from "variant-api";
import { createListener, type IpcRequest, socketPath } from "variant-ipc";
import { attachLogLevel, finishCliLog } from "../src/log-level.ts";
import { runCommand, withVariants } from "./support/cli.js";

const roots: string[] = [];

const waitFor = async (ready: () => boolean): Promise<void> => {
  const deadline = Date.now() + 1000;
  while (!ready()) {
    if (Date.now() > deadline) {
      return;
    }
    await Bun.sleep(10);
  }
};

describe("editor log stream", () => {
  afterEach(() => {
    setLogSink(undefined);
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("sends an info event to the project socket and keeps it off stdout", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    const seen: IpcRequest[] = [];
    const listener = createListener(socketPath(directory), (request) => {
      seen.push(request);
      return {};
    });
    await listener.start();
    const stdout: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdout.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stdout.write;
    try {
      attachLogLevel("warn", { directory });
      log("info", "+ mise install", { step: "create", slug: "add-auth" });
      await finishCliLog();
      await waitFor(() => seen.length > 0);
    } finally {
      process.stdout.write = write;
      setLogSink(undefined);
      await listener.stop();
    }

    expect(seen).toEqual([
      {
        name: "log",
        args: { level: "info", message: "+ mise install", step: "create", slug: "add-auth", origin: "cli" },
      },
      { name: "log", args: { level: "debug", message: "end", step: "cli", origin: "cli" } },
      { name: "log", args: { level: "debug", message: "connected", step: "ipc", origin: "cli" } },
    ]);
    expect(stdout.join("")).not.toContain("+ mise install");
  });

  it("sends the autodetected slug when the event has none and keeps an explicit slug", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    execFileSync("git", ["init", "-q", "-b", "main", directory]);
    const seen: IpcRequest[] = [];
    const listener = createListener(socketPath(directory), (request) => {
      seen.push(request);
      return {};
    });
    await listener.start();
    const stderr: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    try {
      attachLogLevel("debug", { directory });
      log("info", "listed variants");
      log("info", "+ mise install", { step: "create", slug: "add-auth" });
      await finishCliLog();
      await waitFor(() => seen.some((request) => request.args.message === "end"));
    } finally {
      process.stderr.write = write;
      setLogSink(undefined);
      await listener.stop();
    }

    expect(seen).toContainEqual({
      name: "log",
      args: { level: "info", message: "listed variants", origin: "cli", slug: "main" },
    });
    expect(seen).toContainEqual({
      name: "log",
      args: { level: "debug", message: "end", step: "cli", origin: "cli", slug: "main" },
    });
    expect(seen).toContainEqual({
      name: "log",
      args: { level: "info", message: "+ mise install", step: "create", slug: "add-auth", origin: "cli" },
    });
    expect(stderr.join("")).not.toContain("main");
  });

  it("logs connect failure once at debug and does not create the socket", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    try {
      attachLogLevel("debug", { directory });
      log("info", "listed variants");
      log("warn", "still going");
      await finishCliLog();
    } finally {
      process.stderr.write = write;
      setLogSink(undefined);
    }

    expect(lines.filter((line) => line.includes("connect failed"))).toEqual([
      "[debug] ipc connect failed: file not found\n",
    ]);
    expect(existsSync(socketPath(directory))).toBe(false);
  });

  it("logs connect success once at debug", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    const seen: IpcRequest[] = [];
    const listener = createListener(socketPath(directory), (request) => {
      seen.push(request);
      return {};
    });
    await listener.start();
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    try {
      attachLogLevel("debug", { directory });
      log("info", "listed variants");
      log("warn", "still going");
      await finishCliLog();
    } finally {
      process.stderr.write = write;
      setLogSink(undefined);
      await listener.stop();
    }

    expect(lines.filter((line) => line.includes("ipc connected"))).toEqual(["[debug] ipc connected\n"]);
    expect(lines.join("")).not.toContain("connect failed");
    expect(seen.filter((request) => request.args.message === "connected")).toHaveLength(1);
  });

  it("prints one connect-failure debug and one cli-end debug when list finds no editor", () =>
    withVariants(async (environment, directory) => {
      const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
      const result = await runCommand(["bun", cli], ["list", "--log-level=debug"], environment, directory);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("alpha");
      expect(result.stderr.split("\n").filter((line) => line.startsWith("[debug] ipc connect failed"))).toEqual([
        "[debug] ipc connect failed: file not found",
      ]);
      expect(result.stderr.split("\n").filter((line) => line === "[debug] cli end")).toEqual(["[debug] cli end"]);
      expect(existsSync(socketPath(directory))).toBe(false);
    }));

  it("prints one connect-success debug and one cli-end debug when the editor is listening", () =>
    withVariants(async (environment, directory) => {
      const seen: IpcRequest[] = [];
      const listener = createListener(socketPath(directory), (request) => {
        seen.push(request);
        return {};
      });
      await listener.start();
      try {
        const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
        const result = await runCommand(["bun", cli], ["list", "--log-level=debug"], environment, directory);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("alpha");
        expect(result.stderr.split("\n").filter((line) => line === "[debug] ipc connected")).toEqual([
          "[debug] ipc connected",
        ]);
        expect(result.stderr.split("\n").filter((line) => line === "[debug] cli end")).toEqual(["[debug] cli end"]);
        expect(result.stderr).not.toContain("connect failed");
        expect(seen).toContainEqual({
          name: "log",
          args: { level: "debug", message: "end", step: "cli", origin: "cli" },
        });
      } finally {
        await listener.stop();
      }
    }));

  it("hides socket debug at the default threshold", () =>
    withVariants(async (environment, directory) => {
      const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
      const result = await runCommand(["bun", cli], ["list"], environment, directory);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("alpha");
      expect(result.stderr).not.toMatch(/^\[debug\]/m);
    }));

  it("does not connect before the first event", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    mkdirSync(join(directory, ".vscode"), { recursive: true });
    let accepts = 0;
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      accepts += 1;
      sockets.push(socket);
      let buffer = "";
      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          buffer = buffer.slice(newline + 1);
          socket.write("{}\n");
          newline = buffer.indexOf("\n");
        }
      });
    });
    await listen(server, socketPath(directory));
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      attachLogLevel("debug", { directory });
      await Bun.sleep(30);
      expect(accepts).toBe(0);
      log("info", "listed variants");
      log("warn", "still going");
      await finishCliLog();
      expect(accepts).toBe(1);
    } finally {
      process.stderr.write = write;
      setLogSink(undefined);
      for (const socket of sockets) {
        socket.destroy();
      }
      await closeServer(server);
    }
  });

  it("sends an info event that stderr hides below warn", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    const seen: IpcRequest[] = [];
    const listener = createListener(socketPath(directory), (request) => {
      seen.push(request);
      return {};
    });
    await listener.start();
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    try {
      attachLogLevel("warn", { directory });
      log("info", "listed variants");
      await finishCliLog();
    } finally {
      process.stderr.write = write;
      setLogSink(undefined);
      await listener.stop();
    }

    expect(lines.join("")).not.toContain("listed variants");
    expect(seen).toContainEqual({ name: "log", args: { level: "info", message: "listed variants", origin: "cli" } });
  });

  it("does not fail or reconnect when the editor rejects the log request", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    mkdirSync(join(directory, ".vscode"), { recursive: true });
    let accepts = 0;
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      accepts += 1;
      sockets.push(socket);
      let buffer = "";
      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          buffer = buffer.slice(newline + 1);
          socket.write(`${JSON.stringify({ error: { message: "nope" } })}\n`);
          newline = buffer.indexOf("\n");
        }
      });
    });
    await listen(server, socketPath(directory));
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      attachLogLevel("debug", { directory });
      log("info", "one");
      log("warn", "two");
      await finishCliLog();
      expect(accepts).toBe(1);
    } finally {
      process.stderr.write = write;
      setLogSink(undefined);
      for (const socket of sockets) {
        socket.destroy();
      }
      await closeServer(server);
    }
  });

  it("warns once and stops when a write is not answered within one second", async () => {
    const directory = realpathSync(mkdtempSync(join("/tmp", "variant-editor-log-")));
    roots.push(directory);
    mkdirSync(join(directory, ".vscode"), { recursive: true });
    const sockets: Socket[] = [];
    const server = createServer((socket) => {
      sockets.push(socket);
    });
    await listen(server, socketPath(directory));
    const lines: string[] = [];
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    const started = Date.now();
    try {
      attachLogLevel("warn", { directory });
      log("info", "one");
      log("info", "two");
      const outcome = await Promise.race([
        finishCliLog().then(() => "done" as const),
        Bun.sleep(1800).then(() => "hung" as const),
      ]);
      expect(outcome).toBe("done");
      expect(Date.now() - started).toBeLessThan(1800);
      expect(lines.filter((line) => line.includes("write failed"))).toEqual(["[warn] ipc write failed\n"]);
    } finally {
      process.stderr.write = write;
      setLogSink(undefined);
      for (const socket of sockets) {
        socket.destroy();
      }
      await closeServer(server);
    }
  });
});

const listen = (server: Server, path: string): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(path, () => {
      server.off("error", reject);
      resolve();
    });
  });

const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve) => {
    server.close(() => resolve());
  });
