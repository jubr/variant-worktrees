import { describe, expect, it } from "bun:test";
import * as vscode from "vscode";
import { createVariantsStore } from "./variants-store.ts";
import { fakeClient, record } from "./variants-test-support.ts";
import { dbOnlySuffix, type VariantNode, VariantsTreeProvider } from "./variants-tree.ts";

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

const watching = { mode: "watch" as const, watches: { fe: { alive: true } } };
const up = { mode: "up" as const, watches: { fe: { alive: true } } };

describe("variants tree", () => {
  it("returns the same variant node while the record is unchanged", async () => {
    const { provider } = await started([record("demo", { worktree: "/work/_v-demo" })]);
    const slug = (nodes: VariantNode[]): VariantNode | undefined =>
      nodes.find((node) => node.kind === "variant" && node.record.slug === "demo");

    expect(slug(provider.getChildren())).toBe(slug(provider.getChildren()));
  });

  it("returns a new variant node when the record changes", async () => {
    const demo = record("demo", { worktree: "/work/_v-demo" });
    const { provider, fake } = await started([demo]);
    const node = (): VariantNode | undefined =>
      provider.getChildren().find((entry) => entry.kind === "variant" && entry.record.slug === "demo");
    const first = node();
    fake.publish([record("demo", { worktree: "/work/_v-demo", url: "http://demo.vw.localhost:62100" })]);
    const next = node();

    expect(next).not.toBe(first);
    expect(next).toMatchObject({ kind: "variant", record: { url: "http://demo.vw.localhost:62100" } });
  });

  it("marks a database-only variant with a space and a superscript d", async () => {
    const { provider } = await started([record("demo", { dbOnly: true }), record("kept", { worktree: "/work/kept" })]);

    expect(items(provider).map(({ item }) => item.label)).toEqual(["main", `demo${dbOnlySuffix()}`, "kept"]);
  });

  it("uses a superscript 2 when a superscript d cannot be shown", () => {
    expect(dbOnlySuffix(() => false)).toBe(" \u00b2");
    expect(dbOnlySuffix()).toBe(" \u1d48");
  });

  it("lists variants by slug ascending by default, with the slug as label", async () => {
    const { provider } = await started([record("zeta"), record("main"), record("alpha")]);

    expect(items(provider).map(({ item }) => item.label)).toEqual(["main", "alpha", "zeta"]);
  });

  it("keeps main first when the sort is name descending", async () => {
    const fake = fakeClient([record("zeta"), record("main"), record("alpha")]);
    const store = createVariantsStore({ loadClient: async () => fake.client, hasConfig: () => true });
    const provider = new VariantsTreeProvider(store, () => "name-desc");
    await store.start();

    expect(items(provider).map(({ item }) => item.label)).toEqual(["main", "zeta", "alpha"]);
  });

  it("orders by the given sort and keeps the UI server above the variants", async () => {
    const fake = fakeClient([
      record("old", { changedMs: 1 }),
      record("new", { changedMs: 5 }),
      record("main", {
        changedMs: 3,
        watches: { "variant-ui": { alive: true, url: "http://ui.vw.localhost:62100" } },
      }),
    ]);
    const store = createVariantsStore({ loadClient: async () => fake.client, hasConfig: () => true });
    const provider = new VariantsTreeProvider(store, () => "changed-desc");
    await store.start();

    expect(items(provider).map(({ item }) => item.label)).toEqual(["UI server", "main", "new", "old"]);
  });

  it("uses a filled green dot, a hollow dot, and a different up icon", async () => {
    const { provider } = await started([record("a-watching", watching), record("b-up", up), record("c-down")]);
    const icon = (label: string): vscode.ThemeIcon =>
      items(provider).find((entry) => entry.item.label === label)?.item.iconPath as vscode.ThemeIcon;

    expect(icon("a-watching").id).toBe("circle-filled");
    expect(icon("a-watching").color).toEqual(new vscode.ThemeColor("charts.green"));
    expect(icon("c-down").id).toBe("circle-outline");
    expect(icon("b-up").id).toBe("arrow-up");
  });

  it("names the state in words in the tooltip, with mode, URL and worktree", async () => {
    const { provider } = await started([
      record("a-watching", { ...watching, url: "http://a.vw.localhost:62100", worktree: "/work/_v-a-watching" }),
      record("b-up", up),
      record("c-down"),
      record("d-dirty", { implodeClean: false }),
    ]);

    const tip = (label: string): string =>
      String(items(provider).find((entry) => entry.item.label === label)?.item.tooltip);

    expect(tip("a-watching")).toContain("watching");
    expect(tip("a-watching")).toContain("Mode: watch");
    expect(tip("a-watching")).toContain("URL: http://a.vw.localhost:62100");
    expect(tip("a-watching")).toContain("Worktree: /work/_v-a-watching");
    expect(tip("a-watching")).toContain("Implode would succeed");
    expect(tip("b-up")).toContain("up");
    expect(tip("c-down")).toContain("down");
    expect(tip("d-dirty")).toContain("Implode would fail");
  });

  it("notes a stale record in the tooltip of a down variant", async () => {
    const { provider } = await started([record("demo", { mode: "watch", watches: { fe: { alive: false } } })]);

    expect(String(items(provider).find((entry) => entry.item.label === "demo")?.item.tooltip)).toContain("stale");
  });

  it("shows the uptime as description", async () => {
    const { provider } = await started([record("demo", { ...watching, uptimeSeconds: 3700 }), record("idle")]);

    const rows = items(provider);
    const demo = rows.find((entry) => entry.item.label === "demo");
    const idle = rows.find((entry) => entry.item.label === "idle");

    expect(demo?.item.description).toBe("1h 1m");
    expect(idle?.item.description).toBeUndefined();
  });

  it("shows a UI server item above the variants when main records a live variant-ui watch", async () => {
    const { provider } = await started([
      record("main", { watches: { "variant-ui": { alive: true, url: "http://ui.vw.localhost:62100", pid: 42 } } }),
      record("demo"),
    ]);

    const [server, main, demo] = items(provider);

    expect(server?.item.label).toBe("UI server");
    expect(server?.item.description).toBe("http://ui.vw.localhost:62100");
    expect(server?.item.contextValue).toBe("ui-server");
    expect(main?.item.label).toBe("main");
    expect(demo?.item.label).toBe("demo");
  });

  it("shows no UI server item without a live watch", async () => {
    const { provider } = await started([
      record("main", { watches: { "variant-ui": { alive: false, url: "http://ui.vw.localhost:62100" } } }),
    ]);

    expect(items(provider).map(({ item }) => item.label)).toEqual(["main"]);
  });

  it("does not count the UI server as a run of main", async () => {
    const { provider } = await started([
      record("main", { mode: "watch", watches: { "variant-ui": { alive: true, url: "http://ui" } } }),
    ]);

    const main = items(provider).find(({ item }) => item.label === "main");

    expect(String(main?.item.tooltip)).toContain("down");
  });

  it("lists nothing without a variants.yaml", async () => {
    const { provider, store } = await started([record("demo")], false);

    expect(items(provider)).toEqual([]);
    expect(store.status()).toBe("no-config");
  });

  it("shows a down main that cannot be imploded when the library returns no main", async () => {
    const { provider, store } = await started([record("demo")]);
    const labels = items(provider).map(({ item }) => item.label);
    const main = items(provider).find((entry) => entry.item.label === "main");

    expect(labels).toEqual(["main", "demo"]);
    expect(store.status()).toBe("ready");
    expect(String(main?.item.tooltip)).toContain("down");
    expect(String(main?.item.contextValue)).toContain("main");
    expect(String(main?.item.contextValue)).not.toContain("removable");
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
    expect(String(items(provider).find((entry) => entry.item.label === "demo")?.item.tooltip)).toContain("watching");
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

    const row = (): vscode.TreeItem | undefined => items(provider).find((entry) => entry.item.label === "demo")?.item;
    const during = row();
    release();
    await running;
    const after = row();

    expect((during?.iconPath as vscode.ThemeIcon).id).toBe("loading~spin");
    expect(during?.contextValue).toBe("variant pending");
    expect(after?.contextValue).not.toBe("variant pending");
  });

  it("sets context values the menus select on", async () => {
    const { provider } = await started([
      record("main"),
      record("demo", { ...up, log: "/work/_v-demo/variants.watch.log", url: "http://demo" }),
    ]);

    const rows = items(provider);
    const demo = rows.find((entry) => entry.item.label === "demo");
    const main = rows.find((entry) => entry.item.label === "main");

    expect(demo?.item.contextValue).toBe("variant up removable clean has-log has-url");
    expect(main?.item.contextValue).toBe("variant down main dirty");
  });

  it("lists Database unreachable first and drops it when contact returns", async () => {
    const message = "Cannot contact postgres database app at 127.0.0.1:5432";
    const { fake, provider } = await started([record("demo"), record("main")]);
    fake.publish([record("demo"), record("main")], { warning: message });

    const down = items(provider);
    const first = down[0]?.item;
    expect(down.map(({ item }) => item.label)).toEqual(["Database unreachable", "main", "demo"]);
    expect(String(first?.description)).toContain("app");
    expect(String(first?.description)).toContain("127.0.0.1");
    expect(String(first?.tooltip)).toBe(message);
    expect(String(first?.tooltip)).not.toContain("SELECT");
    expect((first?.iconPath as vscode.ThemeIcon).id).toBe("warning");

    fake.publish([record("demo"), record("main"), record("orphan")]);
    expect(items(provider).map(({ item }) => item.label)).not.toContain("Database unreachable");
  });
});
