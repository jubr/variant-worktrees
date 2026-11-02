import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as vscode from "vscode";
import { createActions } from "./variants-actions.ts";
import { buildPanelHtml, createPanelManager } from "./variants-panel.ts";
import { createVariantsStore } from "./variants-store.ts";
import { fakeClient, record } from "./variants-test-support.ts";

const createWebviewPanel = spyOn(vscode.window, "createWebviewPanel");
const showErrorMessage = spyOn(vscode.window, "showErrorMessage");

const INDEX = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Variants</title>
  <link rel="stylesheet" crossorigin href="./chunk-aaa.css"><script type="module" crossorigin src="./chunk-bbb.js"></script></head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

/** A webview panel a test drives: the messages posted to it, and a way to send one from the page. */
const fakePanel = () => {
  const posted: unknown[] = [];
  const receivers = new Set<(message: unknown) => unknown>();
  const disposers = new Set<() => void>();
  let revealed = 0;
  const panel = {
    webview: {
      html: "",
      options: undefined as unknown,
      cspSource: "vscode-webview://abc",
      asWebviewUri: (uri: vscode.Uri) => vscode.Uri.parse(`vscode-webview://abc${uri.fsPath}`),
      postMessage: async (message: unknown) => {
        posted.push(message);
        return true;
      },
      onDidReceiveMessage: (listener: (message: unknown) => unknown) => {
        receivers.add(listener);
        return { dispose: () => receivers.delete(listener) };
      },
    },
    reveal: () => {
      revealed += 1;
    },
    onDidDispose: (listener: () => void) => {
      disposers.add(listener);
      return { dispose: () => disposers.delete(listener) };
    },
    dispose: () => {
      for (const listener of [...disposers]) {
        listener();
      }
    },
  };
  return {
    panel,
    posted,
    revealed: () => revealed,
    send: async (message: unknown) => {
      for (const receiver of [...receivers]) {
        receiver(message);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
};

const setup = async (records = [record("demo")], readIndex: () => string = () => INDEX) => {
  const fake = fakeClient(records);
  const store = createVariantsStore({ loadClient: async () => fake.client, hasConfig: () => true });
  await store.start();
  const actions = createActions({ loadClient: async () => fake.client, records: store.records });
  const page = fakePanel();
  createWebviewPanel.mockImplementation((() => page.panel) as never);
  const manager = createPanelManager({
    extensionUri: vscode.Uri.file("/ext"),
    loadClient: async () => fake.client,
    actions,
    store,
    nonce: () => "n0nce",
    readIndex,
  });
  return { fake, store, page, manager };
};

beforeEach(() => {
  createWebviewPanel.mockClear();
  showErrorMessage.mockClear();
  showErrorMessage.mockImplementation((async () => undefined) as never);
});

describe("panel html", () => {
  const html = buildPanelHtml({
    indexHtml: INDEX,
    nonce: "n0nce",
    cspSource: "vscode-webview://abc",
    toUri: (file) => `vscode-webview://abc/ext/dist/webview/${file}`,
  });

  it("allows scripts only with the nonce", () => {
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? "";

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-n0nce'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("http:");
    expect(csp).not.toContain("https:");
  });

  it("loads styles only from the extension's own files, and the inlined font as data", () => {
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? "";

    expect(csp).toContain("style-src vscode-webview://abc");
    expect(csp).toContain("font-src data:");
  });

  it("points the script and the stylesheet at the extension's files, and gives the script the nonce", () => {
    expect(html).toContain('src="vscode-webview://abc/ext/dist/webview/chunk-bbb.js"');
    expect(html).toContain('href="vscode-webview://abc/ext/dist/webview/chunk-aaa.css"');
    expect(html).toMatch(/<script[^>]*nonce="n0nce"/);
    expect(html).not.toContain('"./');
  });
});

describe("variants panel", () => {
  it("opens one webview panel with scripts on, restricted to the extension's webview files", async () => {
    const { manager } = await setup();

    await manager.open();

    const [type, title, , options] = createWebviewPanel.mock.calls[0] as [
      string,
      string,
      unknown,
      { enableScripts: boolean; localResourceRoots: vscode.Uri[] },
    ];
    expect(type).toBe("variant.panel");
    expect(title).toBe("Variant Worktrees");
    expect(options.enableScripts).toBe(true);
    expect(options.localResourceRoots.map((uri) => uri.fsPath)).toEqual(["/ext/dist/webview"]);
  });

  it("generates the html with a fresh nonce policy", async () => {
    const { manager, page } = await setup();

    await manager.open();

    expect(page.panel.webview.html).toContain("script-src 'nonce-n0nce'");
  });

  it("reveals the open panel instead of opening a second one", async () => {
    const { manager, page } = await setup();

    await manager.open();
    await manager.open();

    expect(createWebviewPanel).toHaveBeenCalledTimes(1);
    expect(page.revealed()).toBe(1);
  });

  it("answers ready with the records of the library", async () => {
    const { manager, page } = await setup([record("demo", { mode: "watch" })]);
    await manager.open();

    await page.send({ type: "ready" });

    expect(page.posted).toEqual([
      { type: "snapshot", records: [expect.objectContaining({ slug: "demo" })], connection: "connected" },
    ]);
  });

  it("runs play of the page as a detached watch and shows the result", async () => {
    const { manager, page, fake } = await setup();
    await manager.open();

    await page.send({ type: "action", id: 7, action: "watch", slug: "demo" });

    expect(fake.calls).toEqual([{ name: "watch", slug: "demo", options: expect.objectContaining({ detach: true }) }]);
    expect(page.posted).toContainEqual({ type: "result", id: 7 });
  });

  it("shows the Variants view as busy while an action of the page runs", async () => {
    const { manager, page, store } = await setup();
    await manager.open();
    const seen: string[][] = [];
    store.onDidChange(() => seen.push([...store.pending()]));

    await page.send({ type: "action", id: 1, action: "down", slug: "demo" });

    expect(seen).toContainEqual(["demo"]);
    expect([...store.pending()]).toEqual([]);
  });

  it("reports a failing action to the page, not as a notification", async () => {
    const { manager, page, fake } = await setup();
    await manager.open();
    fake.failNext("Variant demo is not merged into main");

    await page.send({ type: "action", id: 3, action: "implode", slug: "demo", confirm: true });

    expect(page.posted).toContainEqual({ type: "result", id: 3, error: "Variant demo is not merged into main" });
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  it("refuses an implode the page did not confirm", async () => {
    const { manager, page, fake } = await setup();
    await manager.open();

    await page.send({ type: "action", id: 4, action: "implode", slug: "demo", confirm: false });

    expect(fake.calls).toEqual([]);
    expect(page.posted).toContainEqual({ type: "result", id: 4, error: "implode needs a confirmation" });
  });

  it("stops the UI server for the variant-ui row", async () => {
    const kills: number[] = [];
    const fake = fakeClient([record("main", { instances: { "variant-ui": { alive: true, pid: 99 } } })]);
    const store = createVariantsStore({ loadClient: async () => fake.client, hasConfig: () => true });
    await store.start();
    const page = fakePanel();
    createWebviewPanel.mockImplementation((() => page.panel) as never);
    const manager = createPanelManager({
      extensionUri: vscode.Uri.file("/ext"),
      loadClient: async () => fake.client,
      actions: createActions({
        loadClient: async () => fake.client,
        records: store.records,
        kill: (pid) => kills.push(pid),
      }),
      store,
      nonce: () => "n",
      readIndex: () => INDEX,
    });
    await manager.open();

    await page.send({ type: "action", id: 5, action: "down", slug: "variant-ui" });

    expect(kills).toEqual([99]);
    expect(fake.calls).toEqual([]);
  });

  it("ends its state subscription when the panel is closed", async () => {
    const { manager, page, fake } = await setup();
    await manager.open();
    await page.send({ type: "ready" });
    // The tree's own subscription plus the panel's.
    expect(fake.listeners.size).toBe(2);

    page.panel.dispose();

    expect(fake.listeners.size).toBe(1);
  });

  it("opens a new panel after the old one was closed", async () => {
    const { manager, page } = await setup();
    await manager.open();
    page.panel.dispose();

    await manager.open();

    expect(createWebviewPanel).toHaveBeenCalledTimes(2);
  });

  it("shows an error notification when the app was not built", async () => {
    const { manager } = await setup([record("demo")], () => {
      throw new Error("ENOENT: no such file dist/webview/index.html");
    });
    createWebviewPanel.mockClear();

    await manager.open();

    expect(createWebviewPanel).not.toHaveBeenCalled();
    expect(showErrorMessage.mock.calls[0]?.[0]).toContain("variants app");
  });
});
