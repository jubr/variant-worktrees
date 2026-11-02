import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { readFileSync } from "node:fs";
import * as vscode from "vscode";
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

const context = (): vscode.ExtensionContext =>
  ({ subscriptions: [], extensionUri: vscode.Uri.file("/ext") }) as unknown as vscode.ExtensionContext;

const down = record("demo");
const watching = record("demo", { mode: "watch", instances: { fe: { alive: true } } });

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
  for (const mocked of [
    registerCommand,
    executeCommand,
    createTreeView,
    showWarningMessage,
    showErrorMessage,
    showTextDocument,
    openTextDocument,
    openExternal,
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

describe("Variants view registration", () => {
  it("shows the tree in the variant.variants view", async () => {
    await open();

    const [id, options] = createTreeView.mock.calls[0] as [string, { treeDataProvider: unknown }];
    expect(id).toBe("variant.variants");
    expect(options.treeDataProvider).toBeDefined();
  });

  it("sets the welcome context for a project without variants.yaml", async () => {
    await open([down], { hasConfig: () => false });

    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noConfig", true);
    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noVariants", false);
  });

  it("sets the welcome context for a project without variants", async () => {
    await open([]);

    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noConfig", false);
    expect(executeCommand).toHaveBeenCalledWith("setContext", "variant.noVariants", true);
  });

  it("clears the welcome context when a variant appears", async () => {
    const { fake } = await open([]);

    fake.publish([down]);

    expect(executeCommand).toHaveBeenLastCalledWith("setContext", "variant.noVariants", false);
  });
});

describe("inline actions", () => {
  it("play starts a detached watch of the variant", async () => {
    const { command, node, fake } = await open();

    await command("variant.play")(node("demo"));

    expect(fake.calls).toEqual([{ name: "watch", slug: "demo", options: expect.objectContaining({ detach: true }) }]);
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
    instances: { "variant-ui": { alive: true, pid: 4242, url: "http://ui.vw.localhost:62100" } },
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
      instances: { "variant-ui": { alive: true, pid: 1, url: "http://ui.vw.localhost:62100" } },
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
  type Menu = { command: string; when?: string; group?: string };
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    contributes: {
      commands: Array<{ command: string; title: string; icon?: string | { light: string; dark: string } }>;
      views: Record<string, Array<{ id: string; name: string; when?: string; visibility?: string }>>;
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

  it("contributes the Variant Worktrees section to the Explorer, expanded, only with a folder open", () => {
    const view = views.explorer?.find((entry) => entry.id === "variant.variants");

    expect(view?.name).toBe("Variant Worktrees");
    expect(view?.when).toBe("workspaceFolderCount > 0");
    expect(view?.visibility).toBe("visible");
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
      "variant.sort",
      "variant.openPanel",
      "variant.openInBrowser",
    ]);
  });

  it("contributes a welcome message for no variants.yaml and one that names variant create", () => {
    const noConfig = viewsWelcome.find((entry) => entry.when === "variant.noConfig");
    const noVariants = viewsWelcome.find((entry) => entry.when === "variant.noVariants");

    expect(noConfig?.view).toBe("variant.variants");
    expect(noConfig?.contents).toContain("variants.yaml");
    expect(noVariants?.contents).toContain("variant create");
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
      "variant.openPanel",
      "variant.openInBrowser",
      "variant.stopUiServer",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("offers play on down and up items, stop on watching and up items", () => {
    expect(matches(inline("variant.play")?.when, "variant down removable")).toBe(true);
    expect(matches(inline("variant.play")?.when, "variant up removable")).toBe(true);
    expect(matches(inline("variant.play")?.when, "variant watching removable")).toBe(false);
    expect(matches(inline("variant.stop")?.when, "variant watching removable")).toBe(true);
    expect(matches(inline("variant.stop")?.when, "variant up removable")).toBe(true);
    expect(matches(inline("variant.stop")?.when, "variant down removable")).toBe(false);
  });

  it("offers implode on every item except main, foreground when clean and red when dirty", () => {
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
    expect(clean?.icon).toBe("$(trash)");
    expect(dirty?.title).toBe("Implode (would fail)");
    expect(dirty?.icon).toEqual({
      light: "media/trash-dirty-light.svg",
      dark: "media/trash-dirty-dark.svg",
    });
    const fill = (file: string): string =>
      /fill="(#[0-9a-fA-F]{6})"/.exec(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))?.[1] ?? "";
    const luminance = (hex: string): number => {
      const [r, g, b] = [1, 3, 5].map((at) => {
        const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string): number => {
      const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
      return (lighter + 0.05) / (darker + 0.05);
    };
    expect(contrast(fill("media/trash-dirty-light.svg"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fill("media/trash-dirty-dark.svg"), "#1e1e1e")).toBeGreaterThanOrEqual(4.5);
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
        "variant.stopUiServer",
      ]),
    );
  });
});
