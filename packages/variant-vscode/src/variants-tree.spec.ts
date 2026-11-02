import { describe, expect, it } from "bun:test";
import type * as vscode from "vscode";
import { createVariantsStore } from "./variants-store.ts";
import { fakeClient, record } from "./variants-test-support.ts";
import { type VariantNode, VariantsTreeProvider } from "./variants-tree.ts";

const started = async (records = [record("demo")], hasConfig = true) => {
  const fake = fakeClient(records);
  const store = createVariantsStore({ loadClient: async () => fake.client, hasConfig: () => hasConfig });
  const provider = new VariantsTreeProvider(store);
  await store.start();
  return { fake, store, provider };
};

const items = (provider: VariantsTreeProvider): Array<{ node: VariantNode; item: vscode.TreeItem }> =>
  (provider.getChildren() as VariantNode[]).map((node) => ({
    node,
    item: provider.getTreeItem(node) as vscode.TreeItem,
  }));

const watching = { mode: "watch" as const, instances: { fe: { alive: true } } };
const up = { mode: "up" as const, instances: { fe: { alive: true } } };

describe("variants tree", () => {
  it("lists variants by slug ascending by default, with the slug as label", async () => {
    const { provider } = await started([record("zeta"), record("main"), record("alpha")]);

    expect(items(provider).map(({ item }) => item.label)).toEqual(["alpha", "main", "zeta"]);
  });

  it("orders by the given sort and keeps the UI server above the variants", async () => {
    const fake = fakeClient([
      record("old", { changedMs: 1 }),
      record("new", { changedMs: 5 }),
      record("main", {
        changedMs: 3,
        instances: { "variant-ui": { alive: true, url: "http://ui.vw.localhost:62100" } },
      }),
    ]);
    const store = createVariantsStore({ loadClient: async () => fake.client, hasConfig: () => true });
    const provider = new VariantsTreeProvider(store, () => "changed-desc");
    await store.start();

    expect(items(provider).map(({ item }) => item.label)).toEqual(["UI server", "new", "main", "old"]);
  });

  it("uses three different icons for watching, up and down", async () => {
    const { provider } = await started([record("a-watching", watching), record("b-up", up), record("c-down")]);

    const icons = items(provider).map(({ item }) => (item.iconPath as vscode.ThemeIcon).id);

    expect(new Set(icons).size).toBe(3);
  });

  it("names the state in words in the tooltip, with mode, URL and worktree", async () => {
    const { provider } = await started([
      record("a-watching", { ...watching, url: "http://a.vw.localhost:62100", worktree: "/work/_v-a-watching" }),
      record("b-up", up),
      record("c-down"),
    ]);

    const tips = items(provider).map(({ item }) => String(item.tooltip));

    expect(tips[0]).toContain("watching");
    expect(tips[0]).toContain("Mode: watch");
    expect(tips[0]).toContain("URL: http://a.vw.localhost:62100");
    expect(tips[0]).toContain("Worktree: /work/_v-a-watching");
    expect(tips[1]).toContain("up");
    expect(tips[2]).toContain("down");
  });

  it("notes a stale record in the tooltip of a down variant", async () => {
    const { provider } = await started([record("demo", { mode: "watch", instances: { fe: { alive: false } } })]);

    expect(String(items(provider)[0]?.item.tooltip)).toContain("stale");
  });

  it("shows the uptime as description", async () => {
    const { provider } = await started([record("demo", { ...watching, uptimeSeconds: 3700 }), record("idle")]);

    const [demo, idle] = items(provider);

    expect(demo?.item.description).toBe("1h 1m");
    expect(idle?.item.description).toBeUndefined();
  });

  it("shows a UI server item above the variants when main records a live variant-ui instance", async () => {
    const { provider } = await started([
      record("main", { instances: { "variant-ui": { alive: true, url: "http://ui.vw.localhost:62100", pid: 42 } } }),
      record("demo"),
    ]);

    const [server, demo, main] = items(provider);

    expect(server?.item.label).toBe("UI server");
    expect(server?.item.description).toBe("http://ui.vw.localhost:62100");
    expect(server?.item.contextValue).toBe("ui-server");
    expect(demo?.item.label).toBe("demo");
    expect(main?.item.label).toBe("main");
  });

  it("shows no UI server item without a live instance", async () => {
    const { provider } = await started([
      record("main", { instances: { "variant-ui": { alive: false, url: "http://ui.vw.localhost:62100" } } }),
    ]);

    expect(items(provider).map(({ item }) => item.label)).toEqual(["main"]);
  });

  it("does not count the UI server as a run of main", async () => {
    const { provider } = await started([
      record("main", { mode: "watch", instances: { "variant-ui": { alive: true, url: "http://ui" } } }),
    ]);

    const main = items(provider).find(({ item }) => item.label === "main");

    expect(String(main?.item.tooltip)).toContain("down");
  });

  it("lists nothing without a variants.yaml", async () => {
    const { provider, store } = await started([record("demo")], false);

    expect(items(provider)).toEqual([]);
    expect(store.status()).toBe("no-config");
  });

  it("lists nothing, and says so, when there are no variants", async () => {
    const { provider, store } = await started([]);

    expect(items(provider)).toEqual([]);
    expect(store.status()).toBe("empty");
  });

  it("shows why the library failed to load, as the only item", async () => {
    const store = createVariantsStore({
      loadClient: async () => {
        throw new Error("The variant library could not be loaded: no node:sqlite");
      },
      hasConfig: () => true,
    });
    const provider = new VariantsTreeProvider(store);
    await store.start();

    const [only] = items(provider);

    expect(store.status()).toBe("error");
    expect(only?.item.label).toContain("no node:sqlite");
  });

  it("follows the state subscription without polling", async () => {
    const { provider, fake } = await started([record("demo")]);
    let fired = 0;
    provider.onDidChangeTreeData(() => {
      fired += 1;
    });

    fake.publish([record("demo", watching)]);

    expect(fired).toBe(1);
    expect(String(items(provider)[0]?.item.tooltip)).toContain("watching");
  });

  it("ends its subscription when disposed", async () => {
    const { fake, store } = await started();
    expect(fake.listeners.size).toBe(1);

    store.dispose();

    expect(fake.listeners.size).toBe(0);
  });

  it("marks an item that has an action running with a progress icon and no actions", async () => {
    const { provider, store } = await started([record("demo")]);
    let release: () => void = () => {};
    const running = store.run("demo", () => new Promise<void>((resolve) => (release = resolve)));

    const during = items(provider)[0]?.item;
    release();
    await running;
    const after = items(provider)[0]?.item;

    expect((during?.iconPath as vscode.ThemeIcon).id).toBe("loading~spin");
    expect(during?.contextValue).toBe("variant pending");
    expect(after?.contextValue).not.toBe("variant pending");
  });

  it("sets context values the menus select on", async () => {
    const { provider } = await started([
      record("main"),
      record("demo", { ...up, log: "/work/_v-demo/variants.watch.log", url: "http://demo" }),
    ]);

    const [demo, main] = items(provider);

    expect(demo?.item.contextValue).toBe("variant up removable clean has-log has-url");
    expect(main?.item.contextValue).toBe("variant down main dirty");
  });
});
