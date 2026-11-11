import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as vscode from "vscode";
import { resetEditorFocus } from "./test/mock-vscode.ts";
import { fakeClient, record } from "./variants-test-support.ts";
import type { VariantNode } from "./variants-tree.ts";
import { type ActivityLog, registerVariantsView, type ViewDeps } from "./variants-view.ts";

const registerCommand = spyOn(vscode.commands, "registerCommand");
const executeCommand = spyOn(vscode.commands, "executeCommand");
const createTreeView = spyOn(vscode.window, "createTreeView");
const showWarningMessage = spyOn(vscode.window, "showWarningMessage");
const showErrorMessage = spyOn(vscode.window, "showErrorMessage");
const showTextDocument = spyOn(vscode.window, "showTextDocument");
const openTextDocument = spyOn(vscode.workspace, "openTextDocument");
const openExternal = spyOn(vscode.env, "openExternal");
const createInputBox = spyOn(vscode.window, "createInputBox");

const context = (): vscode.ExtensionContext =>
  ({ subscriptions: [], extensionUri: vscode.Uri.file("/ext") }) as unknown as vscode.ExtensionContext;

const down = record("demo");
const watching = record("demo", { mode: "watch", watches: { fe: { alive: true } } });

const open = async (records = [down], overrides: Partial<ViewDeps> = {}) => {
  const fake = fakeClient(records);
  const kills: Array<[number, string]> = [];
  const view = registerVariantsView(context(), {
    root: "/work/vw",
    loadClient: async () => fake.client,
    hasConfig: () => true,
    kill: (pid, signal) => kills.push([pid, signal]),
    ...overrides,
  });
  await view.store.start();
  const command = (id: string): ((...args: unknown[]) => Promise<void>) => {
    const call = registerCommand.mock.calls.find((entry) => entry[0] === id);
    if (!call) {
      throw new Error(`command ${id} was not registered`);
    }
    return call[1] as (...args: unknown[]) => Promise<void>;
  };
  const node = (slug: string): VariantNode => {
    const found = view.store.records().find((entry) => entry.slug === slug);
    if (!found) {
      throw new Error(`no record ${slug}`);
    }
    return { kind: "variant", record: found };
  };
  return { fake, view, command, node, kills };
};

beforeEach(() => {
  resetEditorFocus();
  for (const mocked of [
    registerCommand,
    executeCommand,
    createTreeView,
    showWarningMessage,
    showErrorMessage,
    showTextDocument,
    openTextDocument,
    openExternal,
    createInputBox,
  ]) {
    mocked.mockClear();
  }
  showWarningMessage.mockImplementation((async () => undefined) as never);
  showErrorMessage.mockImplementation((async () => undefined) as never);
  showTextDocument.mockImplementation((async () => undefined) as never);
  openTextDocument.mockImplementation((async () => ({})) as never);
  openExternal.mockImplementation((async () => true) as never);
});

afterEach(() => {
  executeCommand.mockImplementation((async () => undefined) as never);
});

describe("unreachable database", () => {
  it("shows Database unreachable first in both trees and warns once per outage", async () => {
    const message = "Cannot contact postgres database app at 127.0.0.1:5432";
    const { fake } = await open([record("demo"), record("main")]);
    const calls = createTreeView.mock.calls as Array<
      [
        string,
        { treeDataProvider: { getChildren: () => VariantNode[]; getTreeItem: (node: VariantNode) => vscode.TreeItem } },
      ]
    >;
    expect(calls.map(([id]) => id)).toEqual(["variant.variants", "variant.worktrees"]);

    const labels = (index: number): string[] =>
      calls[index]?.[1].treeDataProvider
        .getChildren()
        .map((node) => String(calls[index]?.[1].treeDataProvider.getTreeItem(node).label)) ?? [];

    fake.publish([record("demo"), record("main")], { warning: message });
    fake.publish([record("demo"), record("main")], { warning: message });
    fake.publish([record("demo"), record("main")], { warning: message });

    expect(labels(0)).toEqual(["Database unreachable", "main", "demo"]);
    expect(labels(1)).toEqual(["Database unreachable", "main", "demo"]);
    expect(showWarningMessage).toHaveBeenCalledTimes(1);
    expect(showWarningMessage).toHaveBeenCalledWith(message);

    fake.publish([record("demo"), record("main")]);
    fake.publish([record("demo"), record("main")], { warning: message });

    expect(showWarningMessage).toHaveBeenCalledTimes(2);
  });
});

describe("Variants view registration", () => {
  it("shows the tree in the variant.variants view", async () => {
    await open();

    const [id, options] = createTreeView.mock.calls[0] as [string, { treeDataProvider: unknown }];
    expect(id).toBe("variant.variants");
    expect(options.treeDataProvider).toBeDefined();
  });

  it("shows the same tree in the activity-bar view", async () => {
    await open();

    const calls = createTreeView.mock.calls as Array<[string, { treeDataProvider: unknown }]>;
    expect(calls.map(([id]) => id)).toEqual(["variant.variants", "variant.worktrees"]);
    expect(calls[0]?.[1].treeDataProvider).toBe(calls[1]?.[1].treeDataProvider);
  });

  it("sets the welcome context for a project without variants.yaml", async () => {
    await open([down], { hasConfig: () => false });

    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noConfig", true);
    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noVariants", false);
  });

  it("lists a down main when the library has no variants", async () => {
    const { view } = await open([]);

    expect(view.store.records().map((entry) => entry.slug)).toEqual(["main"]);
    expect(view.store.records()[0]?.implodeClean).toBe(false);
    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noConfig", false);
    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noVariants", false);
  });

  it("keeps main when another variant appears", async () => {
    const { fake, view } = await open([]);

    fake.publish([down]);

    expect(view.store.records().map((entry) => entry.slug)).toEqual(["main", "demo"]);
    expect(executeCommand).toHaveBeenLastCalledWith("setContext", "variant.noVariants", false);
  });
});

describe("inline actions", () => {
  it("play from the variant root watches in the variant worktree", async () => {
    const foo = record("foo", { worktree: "/work/_v-foo" });
    const fake = fakeClient([foo]);
    const directories: Array<string | undefined> = [];
    const { command, node } = await open([foo], {
      root: "/work",
      loadClient: async (cwd?: string) => {
        directories.push(cwd);
        return fake.client;
      },
    });

    await command("variant.play")(node("foo"));

    expect(fake.calls).toEqual([{ name: "watch", slug: "foo", options: expect.objectContaining({ detach: true }) }]);
    expect(directories.filter((cwd) => cwd !== undefined)).toEqual(["/work/_v-foo"]);
  });

  it("stop from the variant root brings the variant down in its worktree", async () => {
    const foo = record("foo", { worktree: "/work/_v-foo", mode: "watch", watches: { fe: { alive: true } } });
    const fake = fakeClient([foo]);
    const directories: Array<string | undefined> = [];
    const { command, node } = await open([foo], {
      root: "/work",
      loadClient: async (cwd?: string) => {
        directories.push(cwd);
        return fake.client;
      },
    });

    await command("variant.stop")(node("foo"));

    expect(fake.calls.map((call) => [call.name, call.slug])).toEqual([["down", "foo"]]);
    expect(directories.filter((cwd) => cwd !== undefined)).toEqual(["/work/_v-foo"]);
  });

  it("implode from the variant root removes the variant in its worktree", async () => {
    showWarningMessage.mockImplementation((async () => "Implode") as never);
    const foo = record("foo", { worktree: "/work/_v-foo" });
    const fake = fakeClient([foo]);
    const directories: Array<string | undefined> = [];
    const { command, node } = await open([foo], {
      root: "/work",
      loadClient: async (cwd?: string) => {
        directories.push(cwd);
        return fake.client;
      },
    });

    await command("variant.implode")(node("foo"));

    expect(fake.calls.map((call) => [call.name, call.slug])).toEqual([["implode", "foo"]]);
    expect(directories.filter((cwd) => cwd !== undefined)).toEqual(["/work/_v-foo"]);
  });

  it("play on main watches in the main checkout", async () => {
    const main = record("main", { worktree: "/work/app", implodeClean: false });
    const fake = fakeClient([main]);
    const directories: Array<string | undefined> = [];
    const { command, node } = await open([main], {
      root: "/work",
      loadClient: async (cwd?: string) => {
        directories.push(cwd);
        return fake.client;
      },
    });

    await command("variant.play")(node("main"));

    expect(fake.calls).toEqual([{ name: "watch", slug: "main", options: expect.objectContaining({ detach: true }) }]);
    expect(directories.filter((cwd) => cwd !== undefined)).toEqual(["/work/app"]);
  });

  it("play starts a detached watch of the variant", async () => {
    const { command, node, fake } = await open();

    await command("variant.play")(node("demo"));

    expect(fake.calls).toEqual([{ name: "watch", slug: "demo", options: expect.objectContaining({ detach: true }) }]);
  });

  it("shows a loading icon after play until the ready path returns 200, then opens the URL once", async () => {
    const url = "http://demo.vw.localhost:62100";
    let finish: (code: number) => void = () => {};
    const pendingBody = new Promise<number>((resolve) => {
      finish = resolve;
    });
    const fetched: string[] = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((input: string | URL | Request) => {
      fetched.push(String(input));
      return pendingBody.then((code) => new Response(null, { status: code }));
    }) as typeof fetch);
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const downDemo = record("demo", { worktree: "/work/_v-demo", url });
    const kept = record("kept");
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      url,
      mode: "watch",
      watches: { spa: { pid: 5151, url, alive: true } },
    });
    const fake = fakeClient([downDemo, kept]);
    const watch = fake.client.watch.bind(fake.client);
    fake.client.watch = async (slug, options) => {
      const result = await watch(slug, options);
      fake.publish([watchingDemo, kept]);
      return result;
    };
    const client = Object.assign(fake.client, {
      config: () => ({ variant: { watches: { spa: { ready: "/index.html", dir: "." } } } }),
    });

    try {
      const { command, node } = await open([downDemo, kept], { loadClient: async () => client });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      const icon = (slug: string): string => {
        const found = tree.treeDataProvider
          .getChildren()
          .find((entry) => entry.kind === "variant" && entry.record.slug === slug);
        if (!found) {
          throw new Error(`no ${slug}`);
        }
        return (tree.treeDataProvider.getTreeItem(found).iconPath as vscode.ThemeIcon).id;
      };

      await command("variant.play")(node("demo"));

      expect(icon("demo")).toBe("loading~spin");
      expect(
        tree.treeDataProvider.getChildren().map((entry) => (entry.kind === "variant" ? entry.record.slug : entry.kind)),
      ).toEqual(["main", "demo", "kept"]);
      expect(fetched).toEqual(["http://demo.vw.localhost:62100/index.html"]);
      expect(openExternal).not.toHaveBeenCalled();

      finish(200);
      await pendingBody;
      for (let turn = 0; turn < 10; turn += 1) {
        await Promise.resolve();
      }

      expect(icon("demo")).toBe("circle-filled");
      expect(openExternal).toHaveBeenCalledTimes(1);
      expect(String(openExternal.mock.calls[0]?.[0])).toBe(url);
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("keeps the loading icon until the last ready watch returns 200", async () => {
    const rowUrl = "http://demo.vw.localhost:62100";
    const beUrl = "http://demo.vw.localhost:62101";
    const debug: string[] = [];
    const beTimes: number[] = [];
    let finishBe: (code: number) => void = () => {};
    const beBody = new Promise<number>((resolve) => {
      finishBe = resolve;
    });
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((input: string | URL | Request) => {
      const target = String(input);
      if (target.startsWith(beUrl)) {
        beTimes.push(Date.now());
        if (beTimes.length === 1) {
          return Promise.resolve(new Response(null, { status: 503 }));
        }
        return beBody.then((code) => new Response(null, { status: code }));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch);
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const downDemo = record("demo", { worktree: "/work/_v-demo", url: rowUrl });
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      url: rowUrl,
      mode: "watch",
      watches: {
        fe: { pid: 5151, url: rowUrl, alive: true },
        be: { pid: 5152, url: beUrl, alive: true },
      },
    });
    const fake = fakeClient([downDemo]);
    const watch = fake.client.watch.bind(fake.client);
    fake.client.watch = async (slug, options) => {
      const result = await watch(slug, options);
      fake.publish([watchingDemo]);
      return result;
    };
    const client = Object.assign(fake.client, {
      config: () => ({
        variant: {
          watches: {
            fe: { ready: "/index.html", dir: "." },
            be: { ready: "/health", dir: "." },
          },
        },
      }),
    });

    try {
      const { command, node } = await open([downDemo], {
        loadClient: async () => client,
        log: {
          info: () => {},
          error: () => {},
          debug: (message) => debug.push(message),
        },
      });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      const icon = (): string => {
        const found = tree.treeDataProvider
          .getChildren()
          .find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
        if (!found) {
          throw new Error("no demo");
        }
        return (tree.treeDataProvider.getTreeItem(found).iconPath as vscode.ThemeIcon).id;
      };

      await command("variant.play")(node("demo"));
      await Promise.resolve();

      expect(icon()).toBe("loading~spin");
      expect(openExternal).not.toHaveBeenCalled();
      expect(debug).toContain("[watch] fe URL try http://demo.vw.localhost:62100/index.html");
      expect(debug).toContain("[watch] fe URL 200 http://demo.vw.localhost:62100/index.html");
      expect(beTimes).toHaveLength(1);

      const deadline = Date.now() + 2000;
      while (beTimes.length < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(beTimes).toHaveLength(2);
      expect((beTimes[1] ?? 0) - (beTimes[0] ?? 0)).toBeGreaterThanOrEqual(900);
      expect(debug.filter((line) => line.startsWith("[watch] fe "))).toEqual([
        "[watch] fe URL try http://demo.vw.localhost:62100/index.html",
        "[watch] fe URL 200 http://demo.vw.localhost:62100/index.html",
      ]);
      expect(icon()).toBe("loading~spin");
      expect(openExternal).not.toHaveBeenCalled();

      finishBe(200);
      await beBody;
      for (let turn = 0; turn < 10; turn += 1) {
        await Promise.resolve();
      }

      expect(icon()).toBe("circle-filled");
      expect(openExternal).toHaveBeenCalledTimes(1);
      expect(String(openExternal.mock.calls[0]?.[0])).toBe(rowUrl);
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("leaves the loading icon and does not open when the be pid dies before 200", async () => {
    const rowUrl = "http://demo.vw.localhost:62100";
    const beUrl = "http://demo.vw.localhost:62101";
    let beAlive = true;
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(((input: string | URL | Request) => {
      const target = String(input);
      if (target.startsWith(beUrl)) {
        return new Promise(() => {});
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch);
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        if (pid === 5152 && !beAlive) {
          throw new Error("ESRCH");
        }
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const downDemo = record("demo", { worktree: "/work/_v-demo", url: rowUrl });
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      url: rowUrl,
      mode: "watch",
      watches: {
        fe: { pid: 5151, url: rowUrl, alive: true },
        be: { pid: 5152, url: beUrl, alive: true },
      },
    });
    const fake = fakeClient([downDemo]);
    const watch = fake.client.watch.bind(fake.client);
    fake.client.watch = async (slug, options) => {
      const result = await watch(slug, options);
      fake.publish([watchingDemo]);
      return result;
    };
    const client = Object.assign(fake.client, {
      config: () => ({
        variant: {
          watches: {
            fe: { ready: "/index.html", dir: "." },
            be: { ready: "/health", dir: "." },
          },
        },
      }),
    });

    try {
      const { command, node } = await open([downDemo], { loadClient: async () => client });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      const icon = (): string => {
        const found = tree.treeDataProvider
          .getChildren()
          .find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
        if (!found) {
          throw new Error("no demo");
        }
        return (tree.treeDataProvider.getTreeItem(found).iconPath as vscode.ThemeIcon).id;
      };

      await command("variant.play")(node("demo"));
      await Promise.resolve();
      expect(icon()).toBe("loading~spin");

      beAlive = false;
      fake.publish([
        record("demo", {
          worktree: "/work/_v-demo",
          url: rowUrl,
          mode: "watch",
          watches: {
            fe: { pid: 5151, url: rowUrl, alive: true },
            be: { pid: 5152, url: beUrl, alive: false },
          },
        }),
      ]);

      expect(icon()).toBe("circle-filled");
      expect(openExternal).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("leaves the loading icon when the pid dies before the ready path returns 200", async () => {
    const url = "http://demo.vw.localhost:62100";
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((() => new Promise(() => {})) as typeof fetch);
    let alive = true;
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        if (!alive) {
          throw new Error("ESRCH");
        }
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const downDemo = record("demo", { worktree: "/work/_v-demo", url });
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      url,
      mode: "watch",
      watches: { spa: { pid: 5151, url, alive: true } },
    });
    const fake = fakeClient([downDemo]);
    const watch = fake.client.watch.bind(fake.client);
    fake.client.watch = async (slug, options) => {
      const result = await watch(slug, options);
      fake.publish([watchingDemo]);
      return result;
    };
    const client = Object.assign(fake.client, {
      config: () => ({ variant: { watches: { spa: { ready: "/index.html", dir: "." } } } }),
    });

    try {
      const { command, node } = await open([downDemo], { loadClient: async () => client });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      const row = (): vscode.TreeItem => {
        const found = tree.treeDataProvider
          .getChildren()
          .find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
        if (!found) {
          throw new Error("no demo");
        }
        return tree.treeDataProvider.getTreeItem(found);
      };

      await command("variant.play")(node("demo"));
      expect((row().iconPath as vscode.ThemeIcon).id).toBe("loading~spin");

      alive = false;
      fake.publish([
        record("demo", {
          worktree: "/work/_v-demo",
          url,
          mode: "watch",
          watches: { spa: { pid: 5151, url, alive: false } },
        }),
      ]);

      expect((row().iconPath as vscode.ThemeIcon).id).toBe("circle-outline");
      expect(String(row().tooltip)).toContain("stale");
      expect(openExternal).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("does not open a watch that is already healthy when the view loads", async () => {
    const url = "http://demo.vw.localhost:62100";
    const fetched: string[] = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
      fetched.push(String(input));
      return new Response(null, { status: 200 });
    }) as typeof fetch);
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      url,
      mode: "watch",
      watches: { spa: { pid: 5151, url, alive: true } },
    });
    const fake = fakeClient([watchingDemo]);
    const client = Object.assign(fake.client, {
      config: () => ({ variant: { watches: { spa: { ready: "/index.html", dir: "." } } } }),
    });

    try {
      const { view } = await open([watchingDemo], { loadClient: async () => client });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      await view.store.start();
      for (let turn = 0; turn < 10; turn += 1) {
        await Promise.resolve();
      }
      const found = tree.treeDataProvider
        .getChildren()
        .find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
      if (!found) {
        throw new Error("no demo");
      }

      expect((tree.treeDataProvider.getTreeItem(found).iconPath as vscode.ThemeIcon).id).toBe("circle-filled");
      expect(openExternal).not.toHaveBeenCalled();
      expect(fetched).toEqual([]);
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("does not fetch or open a watch this view started when the row has no URL", async () => {
    const fetched: string[] = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
      fetched.push(String(input));
      return new Response(null, { status: 200 });
    }) as typeof fetch);
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const downDemo = record("demo", { worktree: "/work/_v-demo" });
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      mode: "watch",
      watches: { spa: { pid: 5151, alive: true } },
    });
    const fake = fakeClient([downDemo]);
    const watch = fake.client.watch.bind(fake.client);
    fake.client.watch = async (slug, options) => {
      const result = await watch(slug, options);
      fake.publish([watchingDemo]);
      return result;
    };
    const client = Object.assign(fake.client, {
      config: () => ({ variant: { watches: { spa: { ready: "/index.html", dir: "." } } } }),
    });

    try {
      const { command, node } = await open([downDemo], { loadClient: async () => client });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      await command("variant.play")(node("demo"));
      for (let turn = 0; turn < 10; turn += 1) {
        await Promise.resolve();
      }
      const found = tree.treeDataProvider
        .getChildren()
        .find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
      if (!found) {
        throw new Error("no demo");
      }

      expect((tree.treeDataProvider.getTreeItem(found).iconPath as vscode.ThemeIcon).id).toBe("circle-filled");
      expect(fetched).toEqual([]);
      expect(openExternal).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("does not fetch or open a watch that has no ready path", async () => {
    const url = "http://demo.vw.localhost:62100";
    const fetched: string[] = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
      fetched.push(String(input));
      return new Response(null, { status: 200 });
    }) as typeof fetch);
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const downDemo = record("demo", { worktree: "/work/_v-demo", url });
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      url,
      mode: "watch",
      watches: { spa: { pid: 5151, url, alive: true } },
    });
    const fake = fakeClient([downDemo]);
    const watch = fake.client.watch.bind(fake.client);
    fake.client.watch = async (slug, options) => {
      const result = await watch(slug, options);
      fake.publish([watchingDemo]);
      return result;
    };
    const client = Object.assign(fake.client, {
      config: () => ({ variant: { watches: { spa: { dir: "." } } } }),
    });

    try {
      const { command, node } = await open([downDemo], { loadClient: async () => client });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      await command("variant.play")(node("demo"));
      for (let turn = 0; turn < 10; turn += 1) {
        await Promise.resolve();
      }
      const found = tree.treeDataProvider
        .getChildren()
        .find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
      if (!found) {
        throw new Error("no demo");
      }

      expect((tree.treeDataProvider.getTreeItem(found).iconPath as vscode.ThemeIcon).id).toBe("circle-filled");
      expect(fetched).toEqual([]);
      expect(openExternal).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("keeps the loading icon after a non-200 and opens once the ready path returns 200", async () => {
    const url = "http://demo.vw.localhost:62100";
    const fetched: string[] = [];
    let calls = 0;
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (input: string | URL | Request) => {
      fetched.push(String(input));
      calls += 1;
      return new Response(null, { status: calls === 1 ? 503 : 200 });
    }) as typeof fetch);
    const realKill = process.kill.bind(process);
    const killSpy = spyOn(process, "kill").mockImplementation(((pid: number, signal?: number | NodeJS.Signals) => {
      if (signal === 0) {
        return true;
      }
      return realKill(pid, signal);
    }) as typeof process.kill);
    const downDemo = record("demo", { worktree: "/work/_v-demo", url });
    const watchingDemo = record("demo", {
      worktree: "/work/_v-demo",
      url,
      mode: "watch",
      watches: { spa: { pid: 5151, url, alive: true } },
    });
    const fake = fakeClient([downDemo]);
    const watch = fake.client.watch.bind(fake.client);
    fake.client.watch = async (slug, options) => {
      const result = await watch(slug, options);
      fake.publish([watchingDemo]);
      return result;
    };
    const client = Object.assign(fake.client, {
      config: () => ({ variant: { watches: { spa: { ready: "/index.html", dir: "." } } } }),
    });

    try {
      const { command, node } = await open([downDemo], { loadClient: async () => client });
      const tree = createTreeView.mock.calls[0]?.[1] as {
        treeDataProvider: {
          getChildren: () => VariantNode[];
          getTreeItem: (node: VariantNode) => vscode.TreeItem;
        };
      };
      const icon = (): string => {
        const found = tree.treeDataProvider
          .getChildren()
          .find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
        if (!found) {
          throw new Error("no demo");
        }
        return (tree.treeDataProvider.getTreeItem(found).iconPath as vscode.ThemeIcon).id;
      };

      await command("variant.play")(node("demo"));
      for (let turn = 0; turn < 10; turn += 1) {
        await Promise.resolve();
      }

      expect(icon()).toBe("loading~spin");
      expect(fetched).toEqual(["http://demo.vw.localhost:62100/index.html"]);
      expect(openExternal).not.toHaveBeenCalled();

      const deadline = Date.now() + 2000;
      while (fetched.length < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(fetched.length).toBeGreaterThanOrEqual(2);
      expect(icon()).toBe("circle-filled");
      expect(openExternal).toHaveBeenCalledTimes(1);
      expect(String(openExternal.mock.calls[0]?.[0])).toBe(url);
    } finally {
      fetchSpy.mockRestore();
      killSpy.mockRestore();
    }
  });

  it("stop brings the variant down", async () => {
    const { command, node, fake } = await open([watching]);

    await command("variant.stop")(node("demo"));

    expect(fake.calls.map((call) => [call.name, call.slug])).toEqual([["down", "demo"]]);
  });

  it("implode asks in a modal that names the variant, and implodes when accepted", async () => {
    showWarningMessage.mockImplementation((async () => "Implode") as never);
    const { command, node, fake } = await open();

    await command("variant.implode")(node("demo"));

    const [message, options, ...buttons] = showWarningMessage.mock.calls[0] as unknown as [
      string,
      { modal: boolean },
      string,
    ];
    expect(message).toContain("demo");
    expect(options.modal).toBe(true);
    expect((options as { detail?: string }).detail).toContain("branch");
    expect(buttons).toEqual(["Implode"]);
    expect(fake.calls.map((call) => [call.name, call.slug])).toEqual([["implode", "demo"]]);
  });

  it("implode does nothing when the modal is cancelled", async () => {
    const entries: string[] = [];
    const { command, node, fake } = await open([down], {
      log: {
        info: (message, fields) => entries.push(`${message} ${JSON.stringify(fields ?? {})}`),
        error: () => entries.push("error"),
      },
    });

    await command("variant.implode")(node("demo"));

    expect(fake.calls).toEqual([]);
    expect(entries).toEqual(['implode cancelled {"slug":"demo"}']);
  });

  it("shows a non-modal force warning and does not implode before a choice", async () => {
    let choose: (value: string | undefined) => void = () => {};
    showWarningMessage.mockImplementation(
      (() =>
        new Promise((resolve) => {
          choose = resolve;
        })) as never,
    );
    const dirty = record("demo", { implodeClean: false });
    const { command, node, fake } = await open([dirty]);

    const pending = command("variant.implodeDirty")(node("demo"));

    expect(showWarningMessage.mock.calls).toEqual([
      ["Clean implode failed, do you want to `--force`?", "Cancel", "Force"],
    ]);
    expect(fake.calls).toEqual([]);

    choose(undefined);
    await pending;
  });

  it("writes the colored implode report before asking to force, and does not implode", async () => {
    const root = mkdtempSync(join("/tmp", "variant-dirty-report-"));
    const file = join(root, "src/a.ts");
    const git = (...args: string[]): void => {
      execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
    };
    try {
      execFileSync("git", ["init", "-q", "-b", "main", root]);
      git("config", "user.email", "variant@example.test");
      git("config", "user.name", "Variant Tests");
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(file, "export const a = 1;\n");
      git("add", ".");
      git("commit", "-q", "-m", "initial");
      writeFileSync(file, "export const a = 1;\nexport const added = true;\n");

      const seen: string[] = [];
      showWarningMessage.mockImplementation((async () => {
        seen.push("dialog");
        return "Cancel";
      }) as never);
      const dirty = record("demo", { implodeClean: false, worktree: root });
      const { command, node, fake } = await open([dirty], {
        log: {
          info: (message) => seen.push(message),
          error: () => {},
        },
      });

      await command("variant.implodeDirty")(node("demo"));

      const reportAt = seen.findIndex((entry) => entry.includes("\x1b[32m+export const added = true;\x1b[0m"));
      expect(reportAt).toBeGreaterThanOrEqual(0);
      expect(seen.indexOf("dialog")).toBeGreaterThan(reportAt);
      expect(showWarningMessage.mock.calls).toEqual([
        ["Clean implode failed, do you want to `--force`?", "Cancel", "Force"],
      ]);
      expect(fake.calls).toEqual([]);
      expect(readFileSync(file, "utf8")).toBe("export const a = 1;\nexport const added = true;\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("leaves the variant and logs implode cancelled when Force is cancelled", async () => {
    showWarningMessage.mockImplementation((async () => "Cancel") as never);
    const entries: string[] = [];
    const dirty = record("demo", { implodeClean: false });
    const { command, node, fake, view } = await open([dirty], {
      log: {
        info: (message, fields) => entries.push(`${message} ${JSON.stringify(fields ?? {})}`),
        error: () => entries.push("error"),
      },
    });

    await command("variant.implodeDirty")(node("demo"));

    expect(showWarningMessage.mock.calls).toEqual([
      ["Clean implode failed, do you want to `--force`?", "Cancel", "Force"],
    ]);
    expect(fake.calls).toEqual([]);
    expect(view.store.records().map((entry) => entry.slug)).toContain("demo");
    expect(entries).toEqual(['implode cancelled {"slug":"demo"}']);
  });

  it("leaves the variant and logs implode cancelled when the force warning is dismissed", async () => {
    const entries: string[] = [];
    const dirty = record("demo", { implodeClean: false });
    const { command, node, fake, view } = await open([dirty], {
      log: {
        info: (message, fields) => entries.push(`${message} ${JSON.stringify(fields ?? {})}`),
        error: () => entries.push("error"),
      },
    });

    await command("variant.implodeDirty")(node("demo"));

    expect(showWarningMessage.mock.calls).toEqual([
      ["Clean implode failed, do you want to `--force`?", "Cancel", "Force"],
    ]);
    expect(fake.calls).toEqual([]);
    expect(view.store.records().map((entry) => entry.slug)).toContain("demo");
    expect(entries).toEqual(['implode cancelled {"slug":"demo"}']);
  });

  it("implodes with force and skips the clean modal when Force is chosen", async () => {
    showWarningMessage.mockImplementation((async () => "Force") as never);
    const dirty = record("demo", { implodeClean: false });
    const { command, node, fake } = await open([dirty]);

    await command("variant.implodeDirty")(node("demo"));

    expect(showWarningMessage.mock.calls).toEqual([
      ["Clean implode failed, do you want to `--force`?", "Cancel", "Force"],
    ]);
    expect(fake.calls).toEqual([{ name: "implode", slug: "demo", options: expect.objectContaining({ force: true }) }]);
  });

  it("records play in the extension log, including a line the watch reports", async () => {
    const entries: string[] = [];
    const log: ActivityLog = {
      info: (message, fields) => entries.push(`${message} ${JSON.stringify(fields ?? {})}`),
      error: (message, cause) => entries.push(`error ${message} ${cause instanceof Error ? cause.message : ""}`),
    };
    const { command, node, fake } = await open([down], { log });

    await command("variant.play")(node("demo"));
    const reported = fake.calls[0]?.options as { log?: (line: string) => void } | undefined;
    reported?.log?.("nothing was started");

    expect(entries).toEqual(['watch {"slug":"demo"}', 'watch finished {"slug":"demo"}', "nothing was started {}"]);
  });

  it("shows the message of a failing action as an error notification", async () => {
    showWarningMessage.mockImplementation((async () => "Implode") as never);
    const entries: string[] = [];
    const { command, node, fake } = await open([down], {
      log: {
        info: () => {},
        error: (message, cause, fields) =>
          entries.push(`${message} ${cause instanceof Error ? cause.message : ""} ${JSON.stringify(fields ?? {})}`),
      },
    });
    fake.failNext("Variant demo is not merged into main");

    await command("variant.implode")(node("demo"));

    expect(showErrorMessage).toHaveBeenCalledWith("Variant demo is not merged into main");
    expect(entries).toEqual(['implode failed Variant demo is not merged into main {"slug":"demo"}']);
  });

  it("shows a non-modal error when watch fails and logs that failure", async () => {
    const entries: string[] = [];
    const { command, node, fake } = await open([down], {
      log: {
        info: () => {},
        error: (message, cause, fields) =>
          entries.push(`${message} ${cause instanceof Error ? cause.message : ""} ${JSON.stringify(fields ?? {})}`),
      },
    });
    fake.failNext("mise failed");

    await command("variant.play")(node("demo"));

    expect(showErrorMessage).toHaveBeenCalledWith("mise failed");
    expect(entries).toEqual(['watch failed mise failed {"slug":"demo"}']);
  });

  it("shows a non-modal error when down fails and logs that failure", async () => {
    const entries: string[] = [];
    const { command, node, fake } = await open([watching], {
      log: {
        info: () => {},
        error: (message, cause, fields) =>
          entries.push(`${message} ${cause instanceof Error ? cause.message : ""} ${JSON.stringify(fields ?? {})}`),
      },
    });
    fake.failNext("no such variant");

    await command("variant.stop")(node("demo"));

    expect(showErrorMessage).toHaveBeenCalledWith("no such variant");
    expect(entries).toEqual(['stop failed no such variant {"slug":"demo"}']);
  });

  it("shows a non-modal error when a forced implode fails and logs that failure", async () => {
    showWarningMessage.mockImplementation((async () => "Force") as never);
    const entries: string[] = [];
    const dirty = record("demo", { implodeClean: false });
    const { command, node, fake } = await open([dirty], {
      log: {
        info: () => {},
        error: (message, cause, fields) =>
          entries.push(`${message} ${cause instanceof Error ? cause.message : ""} ${JSON.stringify(fields ?? {})}`),
      },
    });
    fake.failNext("worktree is locked");

    await command("variant.implodeDirty")(node("demo"));

    expect(showErrorMessage).toHaveBeenCalledWith("worktree is locked");
    expect(entries).toEqual(['implode failed worktree is locked {"slug":"demo"}']);
  });

  it("shows a progress icon and no actions on the item while the action runs", async () => {
    const { command, node, view } = await open();
    const provider = createTreeView.mock.calls[0]?.[1] as {
      treeDataProvider: { getTreeItem: (n: VariantNode) => vscode.TreeItem };
    };
    const item = () => provider.treeDataProvider.getTreeItem(node("demo"));
    let release: () => void = () => {};
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    view.store.run("demo", () => slow);

    const during = item();
    release();
    await command("variant.play")(node("demo"));

    expect((during.iconPath as vscode.ThemeIcon).id).toBe("loading~spin");
    expect(during.contextValue).toBe("variant pending");
  });

  it("show output opens the log of the record in an editor", async () => {
    const { command, node } = await open([record("demo", { log: "/work/_v-demo/variants.watch.log" })]);

    await command("variant.showOutput")(node("demo"));

    expect((openTextDocument.mock.calls[0]?.[0] as vscode.Uri).fsPath).toBe("/work/_v-demo/variants.watch.log");
    expect(showTextDocument).toHaveBeenCalled();
  });

  it("open URL opens the record's URL in the external browser", async () => {
    const { command, node } = await open([record("demo", { url: "http://demo.vw.localhost:62100" })]);

    await command("variant.openUrl")(node("demo"));

    expect(String(openExternal.mock.calls[0]?.[0])).toBe("http://demo.vw.localhost:62100");
  });

  it("opens the row URL in the external browser and does not open a Cursor browser tab", async () => {
    const { command, node } = await open([record("demo", { url: "http://demo.vw.localhost:62100" })]);

    await command("variant.openUrlExternal")(node("demo"));

    expect(String(openExternal.mock.calls[0]?.[0])).toBe("http://demo.vw.localhost:62100");
    expect(executeCommand.mock.calls.some((call) => call[0] === "simpleBrowser.api.open")).toBe(false);
  });

  it("opens the row URL in a Cursor browser tab and does not open the external browser", async () => {
    const { command, node } = await open([record("demo", { url: "http://demo.vw.localhost:62100" })]);

    await command("variant.openUrlCursor")(node("demo"));

    const opened = executeCommand.mock.calls.find((call) => call[0] === "simpleBrowser.api.open");
    expect(String(opened?.[1])).toBe("http://demo.vw.localhost:62100");
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("refuses to implode main", async () => {
    showWarningMessage.mockImplementation((async () => "Implode") as never);
    const { command, node, fake } = await open([record("main")]);

    await command("variant.implode")(node("main"));

    expect(fake.calls).toEqual([]);
    expect(showErrorMessage).toHaveBeenCalledWith("main cannot be imploded");
  });
});

describe("UI server item", () => {
  const server = record("main", {
    watches: { "variant-ui": { alive: true, pid: 4242, url: "http://ui.vw.localhost:62100" } },
  });

  it("stop ends the server process", async () => {
    const { command, kills } = await open([server]);

    await command("variant.stopUiServer")();

    expect(kills).toEqual([[4242, "SIGTERM"]]);
  });

  it("reports that no server runs when there is none", async () => {
    const { command, kills } = await open([record("main")]);

    await command("variant.stopUiServer")();

    expect(kills).toEqual([]);
    expect(showErrorMessage).toHaveBeenCalledWith("No UI server is running");
  });
});

describe("panel and web page commands", () => {
  const createWebviewPanel = spyOn(vscode.window, "createWebviewPanel");

  it("opens the panel", async () => {
    createWebviewPanel.mockClear();
    const { command } = await open([down], { readIndex: () => "<html><head></head><body></body></html>" });

    await command("variant.openPanel")();

    expect(createWebviewPanel.mock.calls.map((call) => call[0])).toEqual(["variant.panel"]);
  });

  it("opens the web page of the running server with its token", async () => {
    const server = record("main", {
      watches: { "variant-ui": { alive: true, pid: 1, url: "http://ui.vw.localhost:62100" } },
    });
    const { command } = await open([server], { readToken: () => "t0ken" });

    await command("variant.openInBrowser")();

    expect(String(openExternal.mock.calls[0]?.[0])).toBe("http://ui.vw.localhost:62100/?token=t0ken");
  });
});

describe("view actions and the extension socket", () => {
  it("never import the socket module, which refuses lifecycle names", () => {
    for (const file of [
      "variants-view.ts",
      "variants-actions.ts",
      "variants-tree.ts",
      "variants-store.ts",
      "variants-panel.ts",
      "variants-browser.ts",
    ]) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
      expect(source).not.toContain("variant-ipc");
      expect(source).not.toContain("./socket");
    }
  });
});

describe("manifest contributions", () => {
  type Menu = { command: string; when?: string; group?: string; alt?: string };
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    contributes: {
      commands: Array<{ command: string; title: string; icon?: string | { light: string; dark: string } }>;
      views: Record<string, Array<{ id: string; name: string; type?: string; when?: string; visibility?: string }>>;
      viewsWelcome: Array<{ view: string; contents: string; when?: string }>;
      menus: Record<string, Menu[]>;
    };
  };
  const { commands, views, viewsWelcome, menus } = manifest.contributes;
  const inline = (command: string): Menu | undefined =>
    menus["view/item/context"]?.find((entry) => entry.command === command && entry.group?.startsWith("inline"));
  const context = (command: string): Menu | undefined =>
    menus["view/item/context"]?.find((entry) => entry.command === command && !entry.group?.startsWith("inline"));
  const matches = (when: string | undefined, viewItem: string): boolean => {
    const regexes = [...(when ?? "").matchAll(/viewItem =~ \/(.+?)\/(?= &&|$)/g)].map(
      (match) => new RegExp(match[1] as string),
    );
    return regexes.every((regex) => regex.test(viewItem));
  };

  it("stores the sort chosen from the menu", async () => {
    const update = spyOn(vscode.configuration, "update");
    const { command } = await open();

    await command("variant.sort.createdAsc")();

    expect(update).toHaveBeenCalledWith("sort", "created-asc", vscode.ConfigurationTarget.Global);
  });

  it("contributes the Variant Worktrees section to the Explorer, collapsed, only with a folder open", () => {
    const view = views.explorer?.find((entry) => entry.id === "variant.variants");

    expect(view?.name).toBe("Variant Worktrees");
    expect(view?.when).toBe("workspaceFolderCount > 0 && !variant.onboardingOpen");
    expect(view?.visibility).toBe("collapsed");
    expect(view?.when).toContain("workspaceFolderCount > 0");
    expect(views.explorer?.find((entry) => entry.id === "variant.variants")).not.toHaveProperty("type");
    expect(views.explorer?.find((entry) => entry.id === "variant.onboarding")?.type).toBe("webview");
    const settings = (
      JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
        contributes: { configuration: { properties: Record<string, { default?: boolean | string }> } };
      }
    ).contributes.configuration.properties;
    expect(settings["variant.autoExpand"]?.default).toBe(true);
    expect(settings["variant.sort"]?.default).toBe("name-asc");
  });

  it("names the play command variant watch and keeps the play icon", () => {
    const play = commands.find((entry) => entry.command === "variant.play");

    expect(play?.title).toBe("variant watch");
    expect(play?.icon).toBe("$(play)");
  });

  it("puts Sort in the view title immediately left of Open Variants Panel", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      contributes: {
        menus: { "view/title": Array<{ command?: string; submenu?: string; group?: string }> };
      };
    };
    const title = manifest.contributes.menus["view/title"].filter((entry) => entry.group?.startsWith("navigation"));

    expect(title.map((entry) => entry.submenu ?? entry.command)).toEqual([
      "variant.create",
      "variant.sort.name-asc",
      "variant.sort.name-desc",
      "variant.sort.created-asc",
      "variant.sort.created-desc",
      "variant.sort.changed-asc",
      "variant.sort.changed-desc",
      "variant.openPanel",
      "variant.openInBrowser",
    ]);
  });

  it("names the selected sort in the tooltip and checks only that item", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      contributes: {
        commands: Array<{ command: string; title: string }>;
        submenus: Array<{ id: string; label: string }>;
        menus: Record<string, Array<{ command?: string; when?: string }>>;
      };
    };
    const selected = manifest.contributes.submenus.find((entry) => entry.id === "variant.sort.created-desc");
    const shown = manifest.contributes.menus["view/title"]?.find((entry) =>
      entry.when?.includes("variant.currentSort == 'created-desc'"),
    );
    const items = manifest.contributes.menus["variant.sort.name-asc"]?.map((entry) => entry.command);
    const titleOf = (id: string): string | undefined =>
      manifest.contributes.commands.find((entry) => entry.command === id)?.title;

    expect(selected?.label).toBe("Sort: Created (new→old)");
    expect(shown?.when).toContain("variant.currentSort == 'created-desc'");
    expect(items).toEqual([
      "variant.sort.nameAscChecked",
      "variant.sort.nameDesc",
      "variant.sort.createdAsc",
      "variant.sort.createdDesc",
      "variant.sort.changedAsc",
      "variant.sort.changedDesc",
    ]);
    expect(titleOf("variant.sort.nameAscChecked")).toBe("$(check) Name (A→Z)");
    expect(titleOf("variant.sort.nameDesc")).toBe("Name (Z→A)");
    expect(titleOf("variant.sort.createdAsc")).toBe("Created (old→new)");
    expect(titleOf("variant.sort.createdDesc")).toBe("Created (new→old)");
    expect(titleOf("variant.sort.changedAsc")).toBe("Changed (old→new)");
    expect(titleOf("variant.sort.changedDesc")).toBe("Changed (new→old)");
  });

  it("contributes a not-initialized welcome with Onboard", () => {
    const noConfig = viewsWelcome.find((entry) => entry.when === "variant.noConfig");

    expect(noConfig?.view).toBe("variant.variants");
    expect(noConfig?.contents).toContain("not initialized");
    expect(noConfig?.contents).toContain("[Onboard](command:variant.onboardingInit)");
  });

  it("contributes every command the menus and the view use", () => {
    const ids = commands.map((entry) => entry.command);

    for (const id of [
      "variant.play",
      "variant.stop",
      "variant.implode",
      "variant.implodeDirty",
      "variant.showOutput",
      "variant.openUrl",
      "variant.openUrlExternal",
      "variant.openUrlCursor",
      "variant.openPanel",
      "variant.openInBrowser",
      "variant.stopUiServer",
      "variant.create",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("offers play on down items only, and stop on watching and up items", () => {
    expect(matches(inline("variant.play")?.when, "variant down removable")).toBe(true);
    expect(matches(inline("variant.play")?.when, "variant up removable")).toBe(false);
    expect(matches(inline("variant.play")?.when, "variant watching removable")).toBe(false);
    expect(matches(inline("variant.stop")?.when, "variant watching removable")).toBe(true);
    expect(matches(inline("variant.stop")?.when, "variant up removable")).toBe(true);
    expect(matches(inline("variant.stop")?.when, "variant down removable")).toBe(false);
  });

  it("offers implode on every item except main, and a muted explosion when dirty", () => {
    expect(matches(inline("variant.implode")?.when, "variant down removable clean")).toBe(true);
    expect(matches(inline("variant.implode")?.when, "variant watching removable clean")).toBe(true);
    expect(matches(inline("variant.implode")?.when, "variant down removable dirty")).toBe(false);
    expect(matches(inline("variant.implodeDirty")?.when, "variant down removable dirty")).toBe(true);
    expect(matches(inline("variant.implodeDirty")?.when, "variant down main dirty")).toBe(false);
    expect(inline("variant.implode")?.group).toBe("inline@9");
    expect(inline("variant.implodeDirty")?.group).toBe("inline@9");

    const clean = commands.find((entry) => entry.command === "variant.implode");
    const dirty = commands.find((entry) => entry.command === "variant.implodeDirty");
    expect(clean?.title).toBe("Implode (would succeed)");
    expect(clean?.icon).toEqual({ light: "media/explode-light.svg", dark: "media/explode-dark.svg" });
    expect(dirty?.title).toBe("Implode (would fail)");
    expect(dirty?.icon).toEqual({
      light: "media/explode-muted-light.svg",
      dark: "media/explode-muted-dark.svg",
    });
    for (const file of ["media/explode-muted-light.svg", "media/explode-muted-dark.svg"]) {
      expect(readFileSync(new URL(`../${file}`, import.meta.url), "utf8")).toContain('opacity="0.4"');
    }
  });

  it("offers no inline action while an action runs, or on the error item", () => {
    for (const command of ["variant.play", "variant.stop", "variant.implode", "variant.implodeDirty"]) {
      expect(matches(inline(command)?.when, "variant pending")).toBe(false);
      expect(matches(inline(command)?.when, "error")).toBe(false);
    }
  });

  it("offers show output only with a log, and open URL only with a URL", () => {
    expect(matches(context("variant.showOutput")?.when, "variant down removable has-log")).toBe(true);
    expect(matches(context("variant.showOutput")?.when, "variant down removable")).toBe(false);
    expect(matches(context("variant.openUrl")?.when, "variant up removable has-url")).toBe(true);
    expect(matches(context("variant.openUrl")?.when, "variant up removable")).toBe(false);
  });

  it("offers Open url inline left of the run control when the row has a URL", () => {
    const item = inline("variant.openUrlExternal");
    const external = commands.find((entry) => entry.command === "variant.openUrlExternal");
    const cursor = commands.find((entry) => entry.command === "variant.openUrlCursor");

    expect(item?.group).toBe("inline@0");
    expect(item?.alt).toBe("variant.openUrlCursor");
    expect(matches(item?.when, "variant down removable has-url")).toBe(true);
    expect(matches(item?.when, "variant watching removable has-url")).toBe(true);
    expect(matches(item?.when, "variant up removable has-url")).toBe(true);
    expect(matches(item?.when, "variant down removable")).toBe(false);
    expect(matches(item?.when, "variant pending")).toBe(false);
    expect(external?.title).toBe("Open url in external browser");
    expect(external?.icon).toBe("$(link-external)");
    expect(cursor?.title).toBe("Open url in Cursor browser");
    expect(commands.find((entry) => entry.command === "variant.openUrl")?.title).toBe("Variant: Open URL");
    expect(commands.find((entry) => entry.command === "variant.openInBrowser")?.title).toBe(
      "Variant: Open Variants in Browser",
    );
    expect(menus["view/title"]?.find((entry) => entry.command === "variant.openInBrowser")?.group).toBe("navigation@3");
  });

  it("adds the panel and the web page to the context menu of a variant", () => {
    expect(matches(context("variant.openPanel")?.when, "variant down removable")).toBe(true);
    expect(matches(context("variant.openInBrowser")?.when, "variant down removable")).toBe(true);
  });

  it("offers open in browser and stop on the UI server item", () => {
    expect(matches(inline("variant.openInBrowser")?.when, "ui-server")).toBe(true);
    expect(matches(inline("variant.stopUiServer")?.when, "ui-server")).toBe(true);
    expect(matches(inline("variant.stopUiServer")?.when, "variant down removable")).toBe(false);
  });

  it("keeps the item commands out of the command palette", () => {
    const hidden = menus.commandPalette?.filter((entry) => entry.when === "false").map((entry) => entry.command);

    expect(hidden).toEqual(
      expect.arrayContaining([
        "variant.play",
        "variant.stop",
        "variant.implode",
        "variant.implodeDirty",
        "variant.showOutput",
        "variant.openUrl",
        "variant.openUrlExternal",
        "variant.openUrlCursor",
        "variant.stopUiServer",
      ]),
    );
  });
});

const project = () => {
  const directory = mkdtempSync(join("/tmp", "variant-view-"));
  return {
    directory,
    put: (path: string, content = ""): void => {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), content);
    },
    remove: (): void => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

const FOCUS_COMMANDS = ["variant.variants.focus", "variant.worktrees.focus", "workbench.action.focusActiveEditorGroup"];

const focused = (): boolean => executeCommand.mock.calls.some((call) => FOCUS_COMMANDS.includes(String(call[0])));

interface Revealed {
  element: unknown;
  options?: { select?: boolean; focus?: boolean };
}

const revealed = (id: string): Revealed[] => {
  const index = createTreeView.mock.calls.findIndex((call) => call[0] === id);
  const tree = createTreeView.mock.results[index]?.value as { revealed?: Revealed[] } | undefined;
  return tree?.revealed ?? [];
};

const settle = (): Promise<void> => Promise.resolve();

const focusHost = vscode.window as typeof vscode.window & {
  treesStartVisible: boolean;
  activeTextEditor: unknown;
  changeActiveTextEditor: (editor: unknown) => void;
  changeWindowState: (state: { focused: boolean }) => void;
  changeTextEditorSelection: () => void;
};

const fileEditor = (fsPath: string, scheme = "file"): vscode.TextEditor =>
  ({ document: { uri: { scheme, fsPath } } }) as vscode.TextEditor;

interface FocusTree {
  visible: boolean;
  selection: unknown[];
  revealed: Revealed[];
  setVisible: (visible: boolean) => void;
}

const focusTree = (id: string): FocusTree => {
  const index = createTreeView.mock.calls.findIndex((call) => call[0] === id);
  return createTreeView.mock.results[index]?.value as FocusTree;
};

const variantNode = (id: string, slug: string): VariantNode => {
  const index = createTreeView.mock.calls.findIndex((call) => call[0] === id);
  const provider = (createTreeView.mock.calls[index]?.[1] as { treeDataProvider: { getChildren: () => VariantNode[] } })
    .treeDataProvider;
  const node = provider.getChildren().find((entry) => entry.kind === "variant" && entry.record.slug === slug);
  if (node === undefined) {
    throw new Error(`no row ${slug}`);
  }
  return node;
};

const selected = (id: string): Revealed[] => focusTree(id).revealed.filter((entry) => entry.options?.select === true);

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("active file", () => {
  const demo = record("demo", { worktree: "/work/_v-demo" });
  const main = record("main", { worktree: "/work/app" });

  it("selects the worktree row in each visible tree and leaves keyboard focus", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");

    await open([demo, main]);

    const node = variantNode("variant.variants", "demo");
    const reveal = { element: node, options: { select: true, focus: false } };
    expect(selected("variant.variants")).toEqual([reveal]);
    expect(selected("variant.worktrees")).toEqual([reveal]);
    expect(focused()).toBe(false);
  });

  it("drops the selected row before highlighting the variant of the next file", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");
    await open([demo, main]);

    focusHost.changeActiveTextEditor(fileEditor("/work/app/src/a.ts"));

    const node = variantNode("variant.variants", "main");
    expect(focusTree("variant.variants").selection).toEqual([node]);
    expect(focusTree("variant.worktrees").selection).toEqual([node]);
    expect(focused()).toBe(false);
  });

  it("selects main when the active file is in the main checkout", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/app/src/a.ts");

    await open([demo, main]);

    const node = variantNode("variant.variants", "main");
    expect(selected("variant.variants")).toEqual([{ element: node, options: { select: true, focus: false } }]);
    expect(focused()).toBe(false);
  });

  it("selects the longer worktree when the main checkout is a parent", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");

    await open([record("demo", { worktree: "/work/_v-demo" }), record("main", { worktree: "/work" })]);

    expect(selected("variant.variants")[0]?.element).toBe(variantNode("variant.variants", "demo"));
  });

  it("does not reveal a hidden tree until that tree is shown", async () => {
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");

    await open([demo, main]);

    expect(selected("variant.variants")).toEqual([]);
    expect(selected("variant.worktrees")).toEqual([]);
    expect(focused()).toBe(false);

    focusTree("variant.worktrees").setVisible(true);

    const node = variantNode("variant.worktrees", "demo");
    expect(selected("variant.worktrees")).toEqual([{ element: node, options: { select: true, focus: false } }]);
    expect(selected("variant.variants")).toEqual([]);
    expect(focused()).toBe(false);
  });

  it("selects a row that appears while the same file stays active", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");
    const { fake } = await open([main]);

    expect(selected("variant.variants")).toEqual([]);

    fake.publish([main, demo]);

    const node = variantNode("variant.variants", "demo");
    expect(selected("variant.variants")).toEqual([{ element: node, options: { select: true, focus: false } }]);
    expect(focused()).toBe(false);
  });

  it("selects the row when the window gains focus", async () => {
    focusHost.treesStartVisible = true;
    await open([demo, main]);
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");
    focusHost.changeWindowState({ focused: false });

    expect(selected("variant.variants")).toEqual([]);

    focusHost.changeWindowState({ focused: true });

    const node = variantNode("variant.variants", "demo");
    expect(selected("variant.variants")).toEqual([{ element: node, options: { select: true, focus: false } }]);
    expect(focused()).toBe(false);
  });

  it("clears the highlight when the file matches nothing and keeps it when focus leaves the editor", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");
    await open([demo, main]);

    focusHost.changeActiveTextEditor(fileEditor("/other/notes.txt"));

    expect(focusTree("variant.variants").selection).toEqual([]);
    expect(focusTree("variant.worktrees").selection).toEqual([]);
    expect(focused()).toBe(false);

    focusHost.changeActiveTextEditor(fileEditor("/work/_v-demo/src/a.ts"));
    const held = focusTree("variant.variants").selection[0];
    focusHost.changeActiveTextEditor(fileEditor("/work/_v-alpha/a.ts", "output"));
    focusHost.changeTextEditorSelection();
    focusHost.changeActiveTextEditor(undefined);

    expect(focusTree("variant.variants").selection).toEqual([held]);
    expect(focused()).toBe(false);
  });

  it("keeps a hand-picked row until the active editor changes", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/_v-demo/src/a.ts");
    await open([demo, main, record("alpha", { worktree: "/work/_v-alpha" })]);
    const explorer = focusTree("variant.variants");
    const before = explorer.revealed.length;
    explorer.selection = [variantNode("variant.variants", "alpha")];

    expect(explorer.revealed.length).toBe(before);

    focusHost.changeActiveTextEditor(fileEditor("/work/_v-demo/src/b.ts"));

    expect(selected("variant.variants").at(-1)?.element).toBe(variantNode("variant.variants", "demo"));
    expect(focused()).toBe(false);
  });

  it("selects main and not the UI server item", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/app/src/a.ts");
    await open([
      record("main", {
        worktree: "/work/app",
        watches: { "variant-ui": { alive: true, url: "http://ui.vw.localhost:62100" } },
      }),
    ]);

    const node = variantNode("variant.variants", "main");
    expect(node.kind).toBe("variant");
    expect(selected("variant.variants")).toEqual([{ element: node, options: { select: true, focus: false } }]);
  });

  it("uses the configured main checkout when the main row has no worktree", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/app/src/a.ts");
    const fake = fakeClient([demo]);
    (fake.client as { config?: () => { variant: { main: string } } }).config = () => ({
      variant: { main: "/work/app" },
    });

    await open([demo], { root: "/work/vw", loadClient: async () => fake.client });
    await flush();

    const node = variantNode("variant.variants", "main");
    expect(selected("variant.variants")).toEqual([{ element: node, options: { select: true, focus: false } }]);
  });

  it("does not treat the workspace folder as the main checkout", async () => {
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor("/work/vw/src/a.ts");
    const fake = fakeClient([demo]);
    (fake.client as { config?: () => { variant: { main: string } } }).config = () => ({
      variant: { main: "/work/app" },
    });

    await open([demo], { root: "/work/vw", loadClient: async () => fake.client });
    await flush();

    expect(selected("variant.variants")).toEqual([]);
  });

  it("does not expand a collapsed explorer section to select the row", async () => {
    const folder = project();
    folder.put("variants.yaml", "variant: {}\n");
    folder.put("src/a.ts", "");
    focusHost.activeTextEditor = fileEditor(join(folder.directory, "src/a.ts"));
    try {
      registerVariantsView(context(), {
        root: folder.directory,
        hasConfig: () => true,
        loadClient: async () => fakeClient([record("main", { worktree: folder.directory })]).client,
        environment: () => ({}),
      });
      await settle();

      expect(revealed("variant.variants")).toEqual([{ element: undefined, options: { select: false, focus: false } }]);
      expect(selected("variant.worktrees")).toEqual([]);
      expect(focused()).toBe(false);
    } finally {
      folder.remove();
    }
  });

  it("selects a visible explorer row on startup without focusing the activity bar", async () => {
    const folder = project();
    folder.put("variants.yaml", "variant: {}\n");
    const file = join(folder.directory, "src/a.ts");
    folder.put("src/a.ts", "");
    focusHost.treesStartVisible = true;
    focusHost.activeTextEditor = fileEditor(file);
    try {
      registerVariantsView(context(), {
        root: folder.directory,
        hasConfig: () => true,
        loadClient: async () => fakeClient([record("main", { worktree: folder.directory })]).client,
        environment: () => ({}),
      });
      await settle();

      const node = variantNode("variant.variants", "main");
      expect(selected("variant.variants")).toEqual([{ element: node, options: { select: true, focus: false } }]);
      expect(selected("variant.worktrees").every((entry) => entry.options?.focus !== true)).toBe(true);
      expect(focused()).toBe(false);
    } finally {
      folder.remove();
    }
  });
});

describe("section startup", () => {
  it("expands an active project and does not read the environment", async () => {
    const folder = project();
    folder.put("variants.yaml", "variant: {}\n");
    let reads = 0;
    try {
      registerVariantsView(context(), {
        root: folder.directory,
        hasConfig: () => true,
        loadClient: async () => fakeClient([]).client,
        environment: () => {
          reads += 1;
          return {};
        },
      });
      await settle();

      expect(revealed("variant.variants")).toEqual([{ element: undefined, options: { select: false, focus: false } }]);
      expect(revealed("variant.worktrees")).toEqual([]);
      expect(focused()).toBe(false);
      expect(reads).toBe(0);
    } finally {
      folder.remove();
    }
  });

  it("expands again when a config file is found and the section starts collapsed", async () => {
    const folder = project();
    folder.put("variants.yaml", "variant: {}\n");
    try {
      registerVariantsView(context(), {
        root: folder.directory,
        hasConfig: () => true,
        loadClient: async () => fakeClient([]).client,
        environment: () => ({}),
      });
      await settle();

      expect(revealed("variant.variants")).toEqual([{ element: undefined, options: { select: false, focus: false } }]);
      expect(focused()).toBe(false);
    } finally {
      folder.remove();
    }
  });

  it("leaves the section when auto-expand is off", async () => {
    const folder = project();
    folder.put("variants.yaml", "variant: {}\n");
    const get = spyOn(vscode.configuration, "get");
    get.mockImplementation((key: string) => (key === "autoExpand" ? false : undefined));
    try {
      registerVariantsView(context(), {
        root: folder.directory,
        hasConfig: () => true,
        loadClient: async () => fakeClient([]).client,
        environment: () => ({}),
      });
      await settle();

      expect(revealed("variant.variants")).toEqual([]);
      expect(focused()).toBe(false);
    } finally {
      get.mockRestore();
      folder.remove();
    }
  });

  it("expands a detected project and reads the environment once", async () => {
    const folder = project();
    folder.put("fe/vite.config.ts", "export default {};\n");
    let reads = 0;
    try {
      registerVariantsView(context(), {
        root: folder.directory,
        hasConfig: () => false,
        loadClient: async () => fakeClient([]).client,
        environment: () => {
          reads += 1;
          return { POSTGRES_HOST: "h" };
        },
      });
      await settle();

      expect(revealed("variant.variants")).toEqual([{ element: undefined, options: { select: false, focus: false } }]);
      expect(revealed("variant.worktrees")).toEqual([]);
      expect(focused()).toBe(false);
      expect(reads).toBe(1);
    } finally {
      folder.remove();
    }
  });

  it("does not expand when adoption is none, and still reads the environment", async () => {
    const folder = project();
    folder.put("fe/vite.config.ts", "export default {};\n");
    let reads = 0;
    try {
      registerVariantsView(context(), {
        root: folder.directory,
        hasConfig: () => false,
        loadClient: async () => fakeClient([]).client,
        environment: () => {
          reads += 1;
          throw new Error("mise failed");
        },
      });
      await settle();

      expect(revealed("variant.variants")).toEqual([]);
      expect(focused()).toBe(false);
      expect(reads).toBe(1);
    } finally {
      folder.remove();
    }
  });
});

interface InputBox {
  title: string;
  value: string;
  validationMessage?: string;
  accept: () => Promise<void>;
  dismiss: () => void;
}

describe("Create variant", () => {
  it("opens an input titled Create variant", async () => {
    const { command } = await open();

    await command("variant.create")();

    const box = createInputBox.mock.results[0]?.value as InputBox;
    expect(box.title).toBe("Create variant");
  });

  it("creates the slug and lists it", async () => {
    const { command, fake, view } = await open([]);

    await command("variant.create")();
    const box = createInputBox.mock.results[0]?.value as InputBox;
    box.value = "demo";
    await box.accept();

    expect(fake.calls).toEqual([{ name: "create", slug: "demo" }]);
    expect(view.store.records().map((entry) => entry.slug)).toEqual(["main", "demo"]);
  });

  it("rejects an empty value", async () => {
    const { command, fake } = await open([]);

    await command("variant.create")();
    const box = createInputBox.mock.results[0]?.value as InputBox;
    box.value = "  ";
    await box.accept();

    expect(box.validationMessage).toBe("Enter a slug");
    expect(fake.calls).toEqual([]);
  });

  it("does not create when the input is dismissed", async () => {
    const { command, fake, view } = await open([down]);

    await command("variant.create")();
    const box = createInputBox.mock.results[0]?.value as InputBox;
    box.dismiss();

    expect(fake.calls).toEqual([]);
    expect(view.store.records().map((entry) => entry.slug)).toEqual(["main", "demo"]);
  });
});
