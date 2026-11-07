import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MiseFailure, VariantUpdate } from "variant-api";
import { resolveMiseBinary } from "variant-config";
import * as vscode from "vscode";

const { createWebviewViewStub } = vscode as unknown as {
  createWebviewViewStub: (viewType: string) => {
    view: { webview: { html: string; options: unknown } };
    received: unknown[];
    send: (message: unknown) => Promise<void>;
  };
};

import { miseBinPathSetting, registerOnboardingFlow } from "./onboarding.ts";
import { loadVariantClient } from "./variants-client.ts";
import { createVariantsStore } from "./variants-store.ts";
import type { VariantsView } from "./variants-view.ts";

/** Specification: onboarding and tools/mise (the editor scenarios: Trust, Not repeated, Changed setting) */

const showErrorMessage = spyOn(vscode.window, "showErrorMessage");
const showInformationMessage = spyOn(vscode.window, "showInformationMessage");
const showQuickPick = spyOn(vscode.window, "showQuickPick");
const registerProvider = spyOn(vscode.window, "registerWebviewViewProvider");
const executeCommand = spyOn(vscode.commands, "executeCommand");
// Spy the shared configuration object. Replacing `getConfiguration` hides `configuration.update` from other files.
const getSetting = spyOn(vscode.configuration, "get");

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-flow-")));
  for (const mocked of [
    showErrorMessage,
    showInformationMessage,
    showQuickPick,
    registerProvider,
    executeCommand,
    getSetting,
  ]) {
    mocked.mockClear();
  }
  getSetting.mockImplementation(() => undefined);
  showErrorMessage.mockImplementation((async () => undefined) as never);
  showInformationMessage.mockImplementation((async () => undefined) as never);
  showQuickPick.mockImplementation((async () => undefined) as never);
  executeCommand.mockImplementation((async () => undefined) as never);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const setting = (value: unknown): void => {
  getSetting.mockImplementation((key: string) => (key === "mise.binPath" ? value : undefined));
};

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A view whose store is fed by a subscription the test publishes to. */
const view = () => {
  let publish: (update: VariantUpdate) => void = () => {};
  const starts: number[] = [];
  const store = createVariantsStore({
    hasConfig: () => true,
    loadClient: async () =>
      ({
        subscribe: (listener: (update: VariantUpdate) => void) => {
          starts.push(1);
          publish = listener;
          return () => {};
        },
      }) as never,
  });
  return {
    view: { store, loadClient: async () => ({}) as never } as unknown as VariantsView,
    store,
    starts,
    publish: (u: VariantUpdate) => publish(u),
  };
};

const flow = (options: { trust?: (directory: string) => Promise<void> } = {}) => {
  const context = {
    subscriptions: [] as { dispose: () => void }[],
    extensionUri: vscode.Uri.file("/ext"),
    workspaceState: { get: () => undefined, update: async () => {} },
  } as unknown as vscode.ExtensionContext;
  const fed = view();
  const commits: Array<() => void> = [];
  const detected: string[] = [];
  const result = registerOnboardingFlow(context, {
    root,
    view: fed.view,
    watchCommits: (_directory, onCommit) => {
      commits.push(onCommit);
      return { check: () => {}, dispose: () => {} };
    },
    adoption: async () => {
      detected.push("run");
      return { status: "detected", label: "postgres+vite" };
    },
    ...(options.trust ? { trust: options.trust } : {}),
  });
  return { ...fed, ...result, context, commits, detected };
};

const untrusted: MiseFailure = { directory: "/proj", detail: "mise.toml is not trusted", untrusted: true };

describe("miseBinPathSetting", () => {
  it("is the setting, trimmed, and nothing when it is empty or not a string", () => {
    setting("  /opt/tools/mise ");
    expect(miseBinPathSetting()).toBe("/opt/tools/mise");
    setting("");
    expect(miseBinPathSetting()).toBeUndefined();
    setting(undefined);
    expect(miseBinPathSetting()).toBeUndefined();
  });

  it("is read again at every call, so a change applies at once", () => {
    setting("/a/mise");
    expect(miseBinPathSetting()).toBe("/a/mise");
    setting("/b/mise");
    expect(miseBinPathSetting()).toBe("/b/mise");
  });
});

describe("loadVariantClient with the Mise setting", () => {
  it("makes the client again when the setting changed and keeps it while it did not", async () => {
    let value: string | undefined;
    const load = loadVariantClient(root, () => value);

    const first = await load();
    expect(await load()).toBe(first);
    const mise = resolveMiseBinary();
    expect(mise).toBeDefined();
    value = mise;
    const second = await load();

    expect(second).not.toBe(first);
    expect(await load()).toBe(second);
  });
});

describe("onboarding flow", () => {
  it("watches the checkout an AGENTS.md symlink names", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-flow-link-")));
    const workspace = join(parent, "vw");
    const checkout = join(workspace, "variant-worktrees");
    const watched: string[] = [];
    const adopted: string[] = [];
    const commits: Array<() => void> = [];
    let checkoutPath = checkout;
    try {
      mkdirSync(workspace);
      execFileSync("git", ["init", "-q", "-b", "main", checkout]);
      writeFileSync(join(checkout, "AGENTS.md"), "# agents\n");
      symlinkSync(join(checkout, "AGENTS.md"), join(workspace, "AGENTS.md"));
      checkoutPath = realpathSync(checkout);
      const context = {
        subscriptions: [] as { dispose: () => void }[],
        extensionUri: vscode.Uri.file("/ext"),
        workspaceState: { get: () => undefined, update: async () => {} },
      } as unknown as vscode.ExtensionContext;
      registerOnboardingFlow(context, {
        root: workspace,
        view: view().view,
        watchCommits: (directory, onCommit) => {
          watched.push(directory);
          commits.push(onCommit);
          return { check: () => {}, dispose: () => {} };
        },
        adoption: async (directory) => {
          adopted.push(directory);
          return { status: "none" };
        },
      });
      commits[0]?.();
      await settle();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }

    expect(watched).toEqual([checkoutPath]);
    expect(adopted).toEqual([checkoutPath]);
  });

  it("runs init in the checkout an AGENTS.md symlink names", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-flow-init-")));
    const workspace = join(parent, "vw");
    const checkout = join(workspace, "variant-worktrees");
    const cwd: string[] = [];
    let checkoutPath = checkout;
    try {
      mkdirSync(workspace);
      execFileSync("git", ["init", "-q", "-b", "main", checkout]);
      writeFileSync(join(checkout, "AGENTS.md"), "# agents\n");
      symlinkSync(join(checkout, "AGENTS.md"), join(workspace, "AGENTS.md"));
      checkoutPath = realpathSync(checkout);
      const fed = view();
      fed.view.loadClient = async (directory?: string) => {
        cwd.push(directory ?? "");
        return {
          init: async () => ({
            directory: checkoutPath,
            prefix: "_v-",
            file: join(checkoutPath, "variants.yaml"),
            gitignore: { status: "skipped", changed: false, file: null, message: "skipped" },
            mise: { status: "skipped", changed: false, file: null, message: "skipped" },
            detected: { dialect: "sqlite", databaseSource: "default", abbr: "w", prefix: "_v-", watches: [] },
          }),
        } as never;
      };
      const context = {
        subscriptions: [] as { dispose: () => void }[],
        extensionUri: vscode.Uri.file("/ext"),
        workspaceState: { get: () => undefined, update: async () => {} },
      } as unknown as vscode.ExtensionContext;
      registerOnboardingFlow(context, { root: workspace, view: fed.view, nonce: () => "N0NCE" });
      const page = createWebviewViewStub("variant.onboarding");
      const provider = registerProvider.mock.calls.at(-1)?.[1] as {
        resolveWebviewView: (view: unknown) => void;
      };
      provider.resolveWebviewView(page.view);
      await page.send({ type: "init", prefix: "_v-", file: true, gitignore: true, mise: true });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }

    expect(cwd).toEqual([checkoutPath]);
  });

  it("disables the variants.yaml checkbox from the checkout, not the workspace", () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-flow-file-")));
    const workspace = join(parent, "vw");
    const checkout = join(workspace, "variant-worktrees");
    let html = "";
    try {
      mkdirSync(workspace);
      execFileSync("git", ["init", "-q", "-b", "main", checkout]);
      writeFileSync(join(checkout, "AGENTS.md"), "# agents\n");
      writeFileSync(join(checkout, "variants.yaml"), "variant: {}\n");
      symlinkSync(join(checkout, "AGENTS.md"), join(workspace, "AGENTS.md"));
      const context = {
        subscriptions: [] as { dispose: () => void }[],
        extensionUri: vscode.Uri.file("/ext"),
        workspaceState: { get: () => undefined, update: async () => {} },
      } as unknown as vscode.ExtensionContext;
      registerOnboardingFlow(context, { root: workspace, view: view().view, nonce: () => "N0NCE" });
      const page = createWebviewViewStub("variant.onboarding");
      const provider = registerProvider.mock.calls.at(-1)?.[1] as {
        resolveWebviewView: (view: unknown) => void;
      };
      provider.resolveWebviewView(page.view);
      html = page.view.webview.html;
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }

    expect(html).toContain('id="file" type="checkbox" disabled');
    expect(html).toContain("This workspace already has a variants.yaml");
  });

  it("lists unrelated child checkouts and does not init until one is chosen", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-flow-choice-")));
    const workspace = join(parent, "vw");
    const app = join(workspace, "app");
    const other = join(workspace, "other");
    const cwd: string[] = [];
    const watched: string[] = [];
    let appPath = app;
    let otherPath = other;
    showQuickPick.mockImplementation(() => new Promise(() => {}) as ReturnType<typeof vscode.window.showQuickPick>);
    try {
      mkdirSync(workspace);
      execFileSync("git", ["init", "-q", "-b", "main", app]);
      execFileSync("git", ["init", "-q", "-b", "main", other]);
      appPath = realpathSync(app);
      otherPath = realpathSync(other);
      const fed = view();
      fed.view.loadClient = async (directory?: string) => {
        cwd.push(directory ?? "");
        return {
          init: async () => ({
            file: null,
            gitignore: { status: "skipped", changed: false, file: null, message: "skipped" },
            mise: { status: "skipped", changed: false, file: null, message: "skipped" },
          }),
        } as never;
      };
      const context = {
        subscriptions: [] as { dispose: () => void }[],
        extensionUri: vscode.Uri.file("/ext"),
        workspaceState: { get: () => undefined, update: async () => {} },
      } as unknown as vscode.ExtensionContext;
      registerOnboardingFlow(context, {
        root: workspace,
        view: fed.view,
        nonce: () => "N0NCE",
        watchCommits: (directory) => {
          watched.push(directory);
          return { check: () => {}, dispose: () => {} };
        },
      });
      const page = createWebviewViewStub("variant.onboarding");
      const provider = registerProvider.mock.calls.at(-1)?.[1] as
        | { resolveWebviewView: (view: unknown) => void }
        | undefined;
      provider?.resolveWebviewView(page.view);
      await page.send({ type: "init", prefix: "_v-", file: true, gitignore: true, mise: true });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }

    expect([...(showQuickPick.mock.calls[0]?.[0] as string[])].sort()).toEqual([appPath, otherPath].sort());
    expect(cwd).toEqual([]);
    expect(watched).toEqual([]);
  });

  it("initializes the checkout a person picks", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-flow-picked-")));
    const workspace = join(parent, "vw");
    const app = join(workspace, "app");
    const other = join(workspace, "other");
    const cwd: string[] = [];
    const watched: string[] = [];
    let appPath = app;
    try {
      mkdirSync(workspace);
      execFileSync("git", ["init", "-q", "-b", "main", app]);
      execFileSync("git", ["init", "-q", "-b", "main", other]);
      appPath = realpathSync(app);
      showQuickPick.mockImplementation((async () => appPath) as never);
      const fed = view();
      fed.view.loadClient = async (directory?: string) => {
        cwd.push(directory ?? "");
        return {
          init: async () => ({
            file: null,
            gitignore: { status: "skipped", changed: false, file: null, message: "skipped" },
            mise: { status: "skipped", changed: false, file: null, message: "skipped" },
          }),
        } as never;
      };
      const context = {
        subscriptions: [] as { dispose: () => void }[],
        extensionUri: vscode.Uri.file("/ext"),
        workspaceState: { get: () => undefined, update: async () => {} },
      } as unknown as vscode.ExtensionContext;
      registerOnboardingFlow(context, {
        root: workspace,
        view: fed.view,
        nonce: () => "N0NCE",
        watchCommits: (directory) => {
          watched.push(directory);
          return { check: () => {}, dispose: () => {} };
        },
      });
      await settle();
      const page = createWebviewViewStub("variant.onboarding");
      const provider = registerProvider.mock.calls.at(-1)?.[1] as {
        resolveWebviewView: (view: unknown) => void;
      };
      provider.resolveWebviewView(page.view);
      await page.send({ type: "init", prefix: "_v-", file: true, gitignore: true, mise: true });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }

    expect(cwd).toEqual([appPath]);
    expect(watched).toEqual([appPath]);
  });

  it("keeps the workspace folder when the directory dialog is cancelled", async () => {
    const parent = realpathSync(mkdtempSync(join("/tmp", "variant-flow-cancel-")));
    const workspace = join(parent, "vw");
    const app = join(workspace, "app");
    const other = join(workspace, "other");
    const cwd: string[] = [];
    const watched: string[] = [];
    let workspacePath = workspace;
    let html = "";
    try {
      mkdirSync(workspace);
      execFileSync("git", ["init", "-q", "-b", "main", app]);
      execFileSync("git", ["init", "-q", "-b", "main", other]);
      writeFileSync(join(app, "variants.yaml"), "variant: {}\n");
      workspacePath = realpathSync(workspace);
      showQuickPick.mockImplementation((async () => undefined) as never);
      const fed = view();
      fed.view.loadClient = async (directory?: string) => {
        cwd.push(directory ?? "");
        return {
          init: async () => ({
            file: null,
            gitignore: { status: "skipped", changed: false, file: null, message: "skipped" },
            mise: { status: "skipped", changed: false, file: null, message: "skipped" },
          }),
        } as never;
      };
      const context = {
        subscriptions: [] as { dispose: () => void }[],
        extensionUri: vscode.Uri.file("/ext"),
        workspaceState: { get: () => undefined, update: async () => {} },
      } as unknown as vscode.ExtensionContext;
      registerOnboardingFlow(context, {
        root: workspace,
        view: fed.view,
        nonce: () => "N0NCE",
        watchCommits: (directory) => {
          watched.push(directory);
          return { check: () => {}, dispose: () => {} };
        },
      });
      await settle();
      const page = createWebviewViewStub("variant.onboarding");
      const provider = registerProvider.mock.calls.at(-1)?.[1] as {
        resolveWebviewView: (view: unknown) => void;
      };
      provider.resolveWebviewView(page.view);
      html = page.view.webview.html;
      await page.send({ type: "init", prefix: "_v-", file: true, gitignore: true, mise: true });
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }

    expect(watched).toEqual([workspacePath]);
    expect(cwd).toEqual([workspacePath]);
    expect(html).toContain('id="file" type="checkbox" checked');
    expect(html).not.toContain('id="file" type="checkbox" disabled');
  });

  it("checks the notification for every local commit", async () => {
    const { commits, detected } = flow();

    commits[0]?.();
    await settle();

    expect(detected).toEqual(["run"]);
    expect(showInformationMessage.mock.calls[0]?.[0]).toBe(
      "Detected postgres+vite, want to bootstrap Variant in this repo?",
    );
  });

  it("stops watching and listening when the extension is disposed", () => {
    let disposed = 0;
    const context = {
      subscriptions: [] as { dispose: () => void }[],
      extensionUri: vscode.Uri.file("/ext"),
      workspaceState: { get: () => undefined, update: async () => {} },
    };
    registerOnboardingFlow(context as unknown as vscode.ExtensionContext, {
      root,
      view: view().view,
      watchCommits: () => ({
        check: () => {},
        dispose: () => {
          disposed += 1;
        },
      }),
    });

    for (const subscription of context.subscriptions) {
      subscription.dispose();
    }

    expect(disposed).toBe(1);
  });

  it("reports a failed read of the variants for Mise with Trust, once, and reads again after Trust", async () => {
    const trusted: string[] = [];
    const { store, publish, starts } = flow({
      trust: async (directory) => {
        trusted.push(directory);
      },
    });
    showErrorMessage.mockImplementation((async (message: string) =>
      message.startsWith("Mise failed") ? "Trust" : undefined) as never);
    await store.start();

    publish({ records: [], error: "mise failed", mise: untrusted });
    publish({ records: [], error: "mise failed", mise: untrusted });
    await settle();

    expect(showErrorMessage.mock.calls.filter((call) => String(call[0]).startsWith("Mise failed"))).toHaveLength(1);
    expect(showErrorMessage.mock.calls[0]).toEqual(["Mise failed in /proj: mise.toml is not trusted", "Trust"]);
    expect(trusted).toEqual(["/proj"]);
    expect(showInformationMessage).toHaveBeenCalledWith("Trusted the Mise configuration of /proj");
    expect(starts).toHaveLength(2);
  });

  it("shows no Trust button for a failure that trust does not fix", async () => {
    const { store, publish } = flow();
    await store.start();

    publish({ records: [], error: "bad", mise: { directory: "/proj", detail: "invalid TOML", untrusted: false } });
    await settle();

    expect(showErrorMessage.mock.calls[0]).toEqual(["Mise failed in /proj: invalid TOML"]);
  });
});
