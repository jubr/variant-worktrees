import { afterEach, describe, expect, it } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";
import { createListener } from "variant-ipc";
import * as vscode from "vscode";
import { activate, deactivate } from "./extension.ts";
import { bindSockets } from "./socket.ts";

const tempDirectory = (): string => realpathSync(mkdtempSync(join("/tmp", "variant-vscode-ipc-")));

const writeFile = (path: string, contents: string): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, contents);
};

const context = (): vscode.ExtensionContext => ({ subscriptions: [] }) as unknown as vscode.ExtensionContext;

const useFolders = (...paths: string[]): void => {
  vscode.workspace.workspaceFolders = paths.map((fsPath, index) => ({
    uri: { fsPath },
    name: fsPath,
    index,
  })) as unknown as vscode.WorkspaceFolder[];
};

const exchange = (path: string, requestLine: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const socket = createConnection(path);
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("timed out waiting for a response"));
    }, 1000);
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline !== -1) {
        clearTimeout(timer);
        socket.end();
        resolve(buffer.slice(0, newline));
      }
    });
    socket.once("connect", () => {
      socket.write(`${requestLine}\n`);
    });
  });

const linkedLayout = (): { root: string; container: string; main: string; worktree: string; socketFile: string } => {
  const root = tempDirectory();
  const container = join(root, "vw");
  const main = join(container, "variant-worktrees");
  const worktree = join(container, "_v-lib-ipc");
  writeFile(join(main, "AGENTS.md"), "# main\n");
  writeFile(join(main, ".vscode", "settings.json"), "{}\n");
  writeFile(join(worktree, "variants.yaml"), "variant: {}\n");
  writeFile(join(worktree, ".vscode", "settings.json"), "{}\n");
  symlinkSync(join(main, "AGENTS.md"), join(container, "AGENTS.md"));
  symlinkSync(join(main, ".vscode"), join(container, ".vscode"));
  return { root, container, main, worktree, socketFile: join(main, ".vscode", "variant-worktrees.sock") };
};

const singleRepoLayout = (): { root: string; worktree: string; socketFile: string } => {
  const root = tempDirectory();
  const worktree = join(root, "_v-lib-ipc");
  writeFile(join(root, "AGENTS.md"), "# main\n");
  writeFile(join(worktree, "variants.yaml"), "variant: {}\n");
  writeFile(join(worktree, ".vscode", "settings.json"), "{}\n");
  return { root, worktree, socketFile: join(root, ".vscode", "variant-worktrees.sock") };
};

const roots: string[] = [];

describe("extension socket", () => {
  afterEach(async () => {
    vscode.workspace.workspaceFolders = undefined;
    await deactivate();
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("listens on the linked checkout socket for a worktree workspace", async () => {
    const layout = linkedLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);

    await activate(context());

    expect(existsSync(layout.socketFile)).toBe(true);
    expect(existsSync(join(layout.worktree, ".vscode", "variant-worktrees.sock"))).toBe(false);
    const line = await exchange(layout.socketFile, JSON.stringify({ name: "editor", args: {} }));
    expect(line.length).toBeGreaterThan(0);
  });

  it("listens on the linked checkout socket for the main checkout", async () => {
    const layout = linkedLayout();
    roots.push(layout.root);
    useFolders(layout.main);

    await activate(context());

    expect(existsSync(layout.socketFile)).toBe(true);
    const line = await exchange(layout.socketFile, JSON.stringify({ name: "editor", args: {} }));
    expect(line.length).toBeGreaterThan(0);
  });

  it("listens on the repo socket for a single-repo worktree", async () => {
    const layout = singleRepoLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);

    await activate(context());

    expect(existsSync(layout.socketFile)).toBe(true);
    expect(existsSync(join(layout.worktree, ".vscode", "variant-worktrees.sock"))).toBe(false);
  });

  it("shares one listener when two folders resolve to the same socket", async () => {
    const layout = linkedLayout();
    roots.push(layout.root);
    useFolders(layout.container, layout.main);

    await activate(context());

    expect(existsSync(layout.socketFile)).toBe(true);
    const line = await exchange(layout.socketFile, JSON.stringify({ name: "editor", args: {} }));
    expect(line.length).toBeGreaterThan(0);
  });

  it("does not create a socket when no workspace folder is open", async () => {
    const cwdSocket = join(process.cwd(), ".vscode", "variant-worktrees.sock");
    const before = existsSync(cwdSocket);
    vscode.workspace.workspaceFolders = undefined;

    await activate(context());

    expect(existsSync(cwdSocket)).toBe(before);
    if (!before && existsSync(cwdSocket)) {
      rmSync(cwdSocket, { force: true });
    }
  });

  it("refuses create without calling variant-api", async () => {
    const source = readFileSync(new URL("./socket.ts", import.meta.url), "utf8");
    expect(source.includes("variant-api")).toBe(false);

    const layout = singleRepoLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);
    await activate(context());

    const line = await exchange(layout.socketFile, JSON.stringify({ name: "create", args: { slug: "test-feature" } }));
    const body = JSON.parse(line) as { error?: { message?: string } };
    expect(body.error?.message?.length).toBeGreaterThan(0);
  });

  it("refuses list without calling variant-api", async () => {
    const layout = singleRepoLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);
    await activate(context());

    const line = await exchange(layout.socketFile, JSON.stringify({ name: "list", args: {} }));
    const body = JSON.parse(line) as { error?: { message?: string } };
    expect(body.error?.message?.length).toBeGreaterThan(0);
  });

  it.each([
    "up",
    "down",
    "watch",
    "implode",
  ])("refuses %s as a lifecycle command without calling variant-api", async (name) => {
    const layout = singleRepoLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);
    await activate(context());

    const line = await exchange(layout.socketFile, JSON.stringify({ name, args: { slug: "test-feature" } }));
    const body = JSON.parse(line) as { error?: { message?: string } };
    expect(body.error?.message).toBe(`${name} is not handled on the extension socket`);
  });

  it("writes a log request on the Variant Worktrees channel", async () => {
    const infos: string[] = [];
    const original = vscode.window.createOutputChannel;
    vscode.window.createOutputChannel = ((name: string) => ({
      name,
      trace: () => {},
      debug: () => {},
      info: (message: string) => {
        if (name === "Variant Worktrees") {
          infos.push(message);
        }
      },
      warn: () => {},
      error: () => {},
      clear: () => {},
      appendLine: () => {},
      show: () => {},
      dispose: () => {},
    })) as typeof vscode.window.createOutputChannel;
    vscode.env.appName = "Cursor";
    const layout = singleRepoLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);
    try {
      await activate({
        subscriptions: [],
        globalState: { get: () => undefined, update: async () => {} },
        extension: { id: "jubr.variant-worktrees", packageJSON: { identifier: { value: "jubr.variant-worktrees" } } },
        globalStorageUri: { fsPath: "/tmp/variant-worktrees-test" },
      } as unknown as vscode.ExtensionContext);
      const line = await exchange(
        layout.socketFile,
        JSON.stringify({
          name: "log",
          args: { level: "info", message: "+ mise install", step: "create", slug: "add-auth" },
        }),
      );
      expect(JSON.parse(line)).not.toHaveProperty("error");
      expect(infos).toContain('<add-auth> [create] cmd="mise install"');
    } finally {
      vscode.env.appName = undefined;
      vscode.window.createOutputChannel = original;
    }
  });

  it("refuses a log request that has no message and writes no channel line", async () => {
    const written: string[] = [];
    const layout = singleRepoLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);
    await bindSockets(() => {
      written.push("called");
    });

    const line = await exchange(layout.socketFile, JSON.stringify({ name: "log", args: {} }));
    const body = JSON.parse(line) as { error?: { message?: string } };

    expect(body.error?.message?.length).toBeGreaterThan(0);
    expect(written).toEqual([]);
  });

  it("does not know destroy as a lifecycle command any more", async () => {
    const layout = singleRepoLayout();
    roots.push(layout.root);
    useFolders(layout.worktree);
    await activate(context());

    const line = await exchange(layout.socketFile, JSON.stringify({ name: "destroy", args: {} }));
    const body = JSON.parse(line) as { error?: { message?: string } };
    expect(body.error?.message).toBe("unsupported editor request: destroy");
  });

  it("removes the socket it bound when the extension deactivates", async () => {
    const layout = linkedLayout();
    roots.push(layout.root);
    useFolders(layout.main);
    await activate(context());
    expect(existsSync(layout.socketFile)).toBe(true);

    await deactivate();

    expect(existsSync(layout.socketFile)).toBe(false);
  });

  it("leaves a live foreign socket in place on deactivate", async () => {
    const layout = singleRepoLayout();
    roots.push(layout.root);
    mkdirSync(join(layout.root, ".vscode"), { recursive: true });
    const foreign = createListener(layout.socketFile, () => ({ ok: true }));
    await foreign.start();
    useFolders(layout.worktree);

    try {
      await activate(context());
      await deactivate();
      expect(existsSync(layout.socketFile)).toBe(true);
      const line = await exchange(layout.socketFile, JSON.stringify({ name: "list", args: {} }));
      expect(line).toBe('{"ok":true}');
    } finally {
      await foreign.stop();
    }
  });
});
