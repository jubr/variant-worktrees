import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { MiseFailure, VariantUpdate } from "variant-api";
import * as vscode from "vscode";
import { miseBinPathSetting, registerOnboardingFlow } from "./onboarding.ts";
import { loadVariantClient } from "./variants-client.ts";
import { createVariantsStore } from "./variants-store.ts";
import type { VariantsView } from "./variants-view.ts";

/** Specification: onboarding and tools/mise (the editor scenarios: Trust, Not repeated, Changed setting) */

const showErrorMessage = spyOn(vscode.window, "showErrorMessage");
const showInformationMessage = spyOn(vscode.window, "showInformationMessage");
const executeCommand = spyOn(vscode.commands, "executeCommand");
// Spy the shared configuration object. Replacing `getConfiguration` hides `configuration.update` from other files.
const getSetting = spyOn(vscode.configuration, "get");

let root: string;

beforeEach(() => {
  root = realpathSync(mkdtempSync(join("/tmp", "variant-flow-")));
  for (const mocked of [showErrorMessage, showInformationMessage, executeCommand, getSetting]) {
    mocked.mockClear();
  }
  getSetting.mockImplementation(() => undefined);
  showErrorMessage.mockImplementation((async () => undefined) as never);
  showInformationMessage.mockImplementation((async () => undefined) as never);
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
    detect: async () => {
      detected.push("run");
      return { database: "postgres", applications: ["vite"], label: "postgres+vite" };
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
    value = "/opt/tools/mise";
    const second = await load();

    expect(second).not.toBe(first);
    expect(await load()).toBe(second);
  });
});

describe("onboarding flow", () => {
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
