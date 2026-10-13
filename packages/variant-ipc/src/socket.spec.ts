import { describe, expect, it } from "bun:test";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { connect, createListener, socketPath } from "./index.ts";

const tempDirectory = (): string => realpathSync(mkdtempSync(join("/tmp", "variant-ipc-")));

const writeFile = (path: string, contents: string): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
};

const permissionBits = (path: string): number => statSync(path).mode & 0o777;

const exchange = (path: string, requestLines: string[]): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const socket = createConnection(path);
    const responses: string[] = [];
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("timed out waiting for a response"));
    }, 1000);
    const finish = (error?: Error): void => {
      clearTimeout(timer);
      socket.end();
      if (error) {
        reject(error);
        return;
      }
      resolve(responses);
    };
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        responses.push(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (responses.length === requestLines.length) {
          finish();
          return;
        }
      }
    });
    socket.once("error", (error) => finish(error));
    socket.once("connect", () => {
      socket.write(`${requestLines.join("\n")}\n`);
    });
  });

const linkedSocket = (): { root: string; socketFile: string; start: string } => {
  const root = tempDirectory();
  const container = join(root, "vw");
  const main = join(container, "variant-worktrees");
  const worktree = join(container, "_v-lib-ipc");
  writeFile(join(main, "AGENTS.md"), "# main\n");
  writeFile(join(main, ".vscode", "settings.json"), "{}\n");
  writeFile(join(worktree, "variants.yaml"), "variant: {}\n");
  symlinkSync(join(main, "AGENTS.md"), join(container, "AGENTS.md"));
  return { root, socketFile: join(main, ".vscode", "variant-worktrees.sock"), start: worktree };
};

const singleRepoSocket = (): { root: string; socketFile: string; start: string } => {
  const root = tempDirectory();
  const worktree = join(root, "_v-lib-ipc");
  writeFile(join(root, "AGENTS.md"), "# main\n");
  writeFile(join(worktree, "variants.yaml"), "variant: {}\n");
  return { root, socketFile: join(root, ".vscode", "variant-worktrees.sock"), start: worktree };
};

describe("unix socket", () => {
  it("does not call variant-api", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(manifest.dependencies?.["variant-api"]).toBeUndefined();
    expect(manifest.devDependencies?.["variant-api"]).toBeUndefined();
    const sources = readdirSync(new URL(".", import.meta.url))
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".spec.ts"))
      .map((name) => readFileSync(new URL(name, import.meta.url), "utf8"));
    expect(sources.some((source) => source.includes("variant-api"))).toBe(false);
  });

  it("joins a linked checkout .vscode directory with the socket file name", () => {
    const layout = linkedSocket();
    try {
      expect(socketPath(layout.start)).toBe(layout.socketFile);
    } finally {
      rmSync(layout.root, { recursive: true, force: true });
    }
  });

  it("joins a single-repo .vscode directory with the socket file name", () => {
    const layout = singleRepoSocket();
    try {
      expect(socketPath(layout.start)).toBe(layout.socketFile);
    } finally {
      rmSync(layout.root, { recursive: true, force: true });
    }
  });

  it("binds an owner-only socket and an owner-only directory", async () => {
    const root = tempDirectory();
    const path = join(root, ".vscode", "variant-worktrees.sock");
    const listener = createListener(path, () => ({ ok: true }));
    try {
      await listener.start();
      expect(lstatSync(path).isSocket()).toBe(true);
      expect(permissionBits(path) & 0o077).toBe(0);
      expect(permissionBits(join(root, ".vscode")) & 0o077).toBe(0);
    } finally {
      await listener.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps the mode of an existing directory", async () => {
    const root = tempDirectory();
    const directory = join(root, ".vscode");
    const path = join(directory, "variant-worktrees.sock");
    mkdirSync(directory, { recursive: true });
    chmodSync(directory, 0o755);
    const listener = createListener(path, () => ({ ok: true }));
    try {
      await listener.start();
      expect(permissionBits(directory)).toBe(0o755);
      expect(permissionBits(path) & 0o077).toBe(0);
    } finally {
      await listener.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("replaces a leftover socket file and accepts a connection", async () => {
    const root = tempDirectory();
    const path = join(root, ".vscode", "variant-worktrees.sock");
    writeFile(path, "stale");
    const listener = createListener(path, (request) => ({ slug: request.args.slug }));
    try {
      await listener.start();
      const [line] = await exchange(path, [JSON.stringify({ name: "create", args: { slug: "test-feature" } })]);
      expect(line).toBe('{"slug":"test-feature"}');
    } finally {
      await listener.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a second listener while the first still accepts connections", async () => {
    const root = tempDirectory();
    const path = join(root, "variant-worktrees.sock");
    const first = createListener(path, () => ({ ok: true }));
    const second = createListener(path, () => ({ ok: false }));
    try {
      await first.start();
      await expect(second.start()).rejects.toThrow();
      const [line] = await exchange(path, [JSON.stringify({ name: "list", args: {} })]);
      expect(line).toBe('{"ok":true}');
    } finally {
      await second.stop();
      await first.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("delivers name and args and returns the handler value", async () => {
    const root = tempDirectory();
    const path = join(root, "variant-worktrees.sock");
    const seen: unknown[] = [];
    const listener = createListener(path, (request) => {
      seen.push(request);
      return { slug: "test-feature" };
    });
    try {
      await listener.start();
      const [line] = await exchange(path, [JSON.stringify({ name: "create", args: { slug: "test-feature" } })]);
      expect(seen).toEqual([{ name: "create", args: { slug: "test-feature" } }]);
      expect(line).toBe('{"slug":"test-feature"}');
    } finally {
      await listener.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns a non-empty error message when the handler fails", async () => {
    const root = tempDirectory();
    const path = join(root, "variant-worktrees.sock");
    const listener = createListener(path, () => {
      throw new Error("handler failed");
    });
    try {
      await listener.start();
      const [line] = await exchange(path, [JSON.stringify({ name: "list", args: {} })]);
      const body = JSON.parse(line ?? "") as { error?: { message?: string } };
      expect(body.error?.message?.length).toBeGreaterThan(0);
    } finally {
      await listener.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an invalid line and still accepts a later connection", async () => {
    const root = tempDirectory();
    const path = join(root, "variant-worktrees.sock");
    const listener = createListener(path, () => ({ ok: true }));
    try {
      await listener.start();
      const [invalid] = await exchange(path, ["not-json"]);
      const invalidBody = JSON.parse(invalid ?? "") as { error?: { message?: string } };
      expect(invalidBody.error?.message?.length).toBeGreaterThan(0);
      const [line] = await exchange(path, [JSON.stringify({ name: "list", args: {} })]);
      expect(line).toBe('{"ok":true}');
    } finally {
      await listener.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("answers two requests on one connection in order", async () => {
    const root = tempDirectory();
    const path = join(root, "variant-worktrees.sock");
    const listener = createListener(path, (request) => ({ n: request.args.n }));
    try {
      await listener.start();
      const lines = await exchange(path, [
        JSON.stringify({ name: "list", args: { n: 1 } }),
        JSON.stringify({ name: "list", args: { n: 2 } }),
      ]);
      expect(lines).toEqual(['{"n":1}', '{"n":2}']);
    } finally {
      await listener.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails a connect when no listener is bound and does not create the socket", async () => {
    const root = tempDirectory();
    const path = join(root, ".vscode", "variant-worktrees.sock");
    try {
      expect(existsSync(path)).toBe(false);
      await expect(connect(path)).rejects.toThrow();
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("removes the socket file when the listener stops", async () => {
    const root = tempDirectory();
    const path = join(root, ".vscode", "variant-worktrees.sock");
    const listener = createListener(path, () => ({ ok: true }));
    try {
      await listener.start();
      expect(existsSync(path)).toBe(true);
      await listener.stop();
      expect(existsSync(path)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("leaves the live socket in place when a failed listener stops", async () => {
    const root = tempDirectory();
    const path = join(root, ".vscode", "variant-worktrees.sock");
    const first = createListener(path, () => ({ ok: true }));
    const second = createListener(path, () => ({ ok: false }));
    try {
      await first.start();
      await expect(second.start()).rejects.toThrow();
      await second.stop();
      expect(existsSync(path)).toBe(true);
      const [line] = await exchange(path, [JSON.stringify({ name: "list", args: {} })]);
      expect(line).toBe('{"ok":true}');
    } finally {
      await first.stop();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
