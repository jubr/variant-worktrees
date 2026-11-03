import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { InitOptions, InitResult } from "variant-api";
import * as vscode from "vscode";
import { createMiseGuard } from "./mise-guard.ts";
import { registerOnboarding } from "./onboarding-view.ts";
import type { VariantsStore } from "./variants-store.ts";

/** Specification: onboarding (Onboarding command and dialog), tools/mise (Init in the dialog) */

const { createWebviewViewStub } = vscode as unknown as {
  createWebviewViewStub: (viewType: string) => {
    view: { webview: { html: string; options: unknown } };
    received: unknown[];
    send: (message: unknown) => Promise<void>;
  };
};

const registerProvider = spyOn(vscode.window, "registerWebviewViewProvider");
const registerCommand = spyOn(vscode.commands, "registerCommand");
const executeCommand = spyOn(vscode.commands, "executeCommand");
const showInformationMessage = spyOn(vscode.window, "showInformationMessage");
const showTextDocument = spyOn(vscode.window, "showTextDocument");
const openTextDocument = spyOn(vscode.workspace, "openTextDocument");

const result = (extra: Partial<InitResult> = {}): InitResult => ({
  directory: "/work",
  prefix: "_v-",
  file: "/work/variants.yaml",
  gitignore: { status: "created", changed: true, file: "/work/.gitignore", message: "created .gitignore with _v-*" },
  mise: { status: "created", changed: true, file: "/work/mise.toml", message: "created mise.toml with tool" },
  detected: { dialect: "sqlite", databaseSource: "default", abbr: "w", prefix: "_v-", watches: [] },
  ...extra,
});

const miseError = (untrusted: boolean) =>
  Object.assign(new Error("mise failed"), { name: "MiseError", directory: "/work", detail: "not trusted", untrusted });

const setup = (
  init: (options: InitOptions) => Promise<InitResult> | InitResult = () => result(),
  trustFailure?: string,
) => {
  const calls: InitOptions[] = [];
  const starts: number[] = [];
  const trusted: string[] = [];
  let hasConfig = false;
  const errors: string[] = [];
  const guard = createMiseGuard({
    trust: async (directory) => {
      if (trustFailure !== undefined) {
        throw new Error(trustFailure);
      }
      trusted.push(directory);
    },
    showError: async (message) => {
      errors.push(message);
      return undefined;
    },
    showInfo: async () => undefined,
  });
  const context = { subscriptions: [] as { dispose: () => void }[] } as unknown as vscode.ExtensionContext;
  const onboarding = registerOnboarding(context, {
    extensionUri: vscode.Uri.file("/ext"),
    loadClient: async () =>
      ({
        init: async (options: InitOptions) => {
          calls.push(options);
          return init(options);
        },
      }) as never,
    store: { start: async () => void starts.push(1) } as unknown as VariantsStore,
    guard,
    hasConfig: () => hasConfig,
    nonce: () => "N0NCE",
  });
  const page = createWebviewViewStub("variant.onboarding");
  const provider = registerProvider.mock.calls.at(-1)?.[1] as { resolveWebviewView: (view: unknown) => void };
  provider.resolveWebviewView(page.view);
  const command = registerCommand.mock.calls.find(
    (entry) => entry[0] === "variant.onboardingInit",
  )?.[1] as () => Promise<void>;
  return {
    onboarding,
    page,
    calls,
    starts,
    trusted,
    errors,
    context,
    command,
    setHasConfig: (value: boolean) => {
      hasConfig = value;
    },
  };
};

const contexts = (): unknown[] =>
  executeCommand.mock.calls.filter((call) => call[0] === "setContext").map((call) => [call[1], call[2]]);
const commandsRun = (): unknown[] => executeCommand.mock.calls.map((call) => call[0]);
const init = (overrides: Record<string, unknown> = {}) => ({
  type: "init",
  prefix: "_v-",
  file: true,
  gitignore: true,
  mise: true,
  ...overrides,
});

beforeEach(() => {
  for (const mocked of [
    registerProvider,
    registerCommand,
    executeCommand,
    showInformationMessage,
    showTextDocument,
    openTextDocument,
  ]) {
    mocked.mockClear();
  }
  executeCommand.mockImplementation((async () => undefined) as never);
  showInformationMessage.mockImplementation((async () => undefined) as never);
  showTextDocument.mockImplementation((async () => undefined) as never);
  openTextDocument.mockImplementation((async (target: unknown) => ({ target })) as never);
});

describe("the onboarding view", () => {
  it("registers the webview view and keeps its page when hidden", () => {
    setup();

    expect(registerProvider.mock.calls[0]?.[0]).toBe("variant.onboarding");
    expect(registerProvider.mock.calls[0]?.[2]).toEqual({ webviewOptions: { retainContextWhenHidden: true } });
  });

  it("resolves with scripts enabled, the media folder as its only resource root and the page", () => {
    const { page } = setup();

    expect(page.view.webview.options).toMatchObject({ enableScripts: true });
    expect(
      (page.view.webview.options as { localResourceRoots: { fsPath: string }[] }).localResourceRoots.map(
        (uri) => uri.fsPath,
      ),
    ).toEqual(["/ext/media"]);
    expect(page.view.webview.html).toContain("script-src 'nonce-N0NCE'");
    expect(page.view.webview.html).toContain("/ext/media/icon-128.png");
  });

  it("shows the first checkbox unchecked and disabled when a variants.yaml exists", () => {
    registerOnboarding({ subscriptions: [] } as unknown as vscode.ExtensionContext, {
      extensionUri: vscode.Uri.file("/ext"),
      loadClient: async () => ({}) as never,
      store: { start: async () => {} } as unknown as VariantsStore,
      guard: createMiseGuard({
        trust: async () => {},
        showError: async () => undefined,
        showInfo: async () => undefined,
      }),
      hasConfig: () => true,
    });
    const page = createWebviewViewStub("variant.onboarding");
    (registerProvider.mock.calls.at(-1)?.[1] as { resolveWebviewView: (view: unknown) => void }).resolveWebviewView(
      page.view,
    );

    expect(page.view.webview.html).toMatch(/<input id="file" type="checkbox" disabled \/>/);
  });
});

describe("variant.onboardingInit", () => {
  it("sets the context, focuses the section and asks it to grow", async () => {
    const { command, onboarding } = setup();

    await command();

    expect(contexts()).toEqual([["variant.onboardingOpen", true]]);
    expect(commandsRun()).toContain("variant.onboarding.focus");
    expect(commandsRun().filter((id) => id === "workbench.action.increaseViewSize").length).toBeGreaterThan(0);
    expect(onboarding.isOpen()).toBe(true);
  });

  it("only focuses when the dialog is open and sets the context once", async () => {
    const { command } = setup();

    await command();
    await command();

    expect(contexts()).toEqual([["variant.onboardingOpen", true]]);
    expect(commandsRun().filter((id) => id === "variant.onboarding.focus")).toHaveLength(2);
  });

  it("clears the context when the extension is disposed", async () => {
    const { command, context } = setup();
    await command();

    for (const subscription of context.subscriptions) {
      subscription.dispose();
    }

    expect(contexts().at(-1)).toEqual(["variant.onboardingOpen", false]);
  });
});

describe("dialog messages", () => {
  it("Cancel shows the tree again, refreshes the store and changes nothing", async () => {
    const { command, page, calls, starts } = setup();
    await command();

    await page.send({ type: "cancel" });

    expect(contexts().at(-1)).toEqual(["variant.onboardingOpen", false]);
    expect(commandsRun()).toContain("variant.variants.focus");
    expect(starts).toHaveLength(1);
    expect(calls).toEqual([]);
  });

  it("Init runs init with the prefix and the choices, then closes, opens the file and confirms each step", async () => {
    const { command, page, calls } = setup();
    await command();

    await page.send(init({ prefix: "wt-", gitignore: false }));

    expect(calls).toEqual([{ prefix: "wt-", file: true, gitignore: false, mise: true }]);
    expect(contexts().at(-1)).toEqual(["variant.onboardingOpen", false]);
    expect(openTextDocument).toHaveBeenCalledWith("/work/variants.yaml");
    expect(showTextDocument).toHaveBeenCalled();
    const message = showInformationMessage.mock.calls[0]?.[0] as string;
    expect(message).toContain("wrote variants.yaml");
    expect(message).toContain("created .gitignore with _v-*");
    expect(message).toContain("created mise.toml");
  });

  it("does not open a file when the file step was off, and leaves skipped steps out of the confirmation", async () => {
    const { command, page } = setup(() =>
      result({ file: null, gitignore: { status: "skipped", changed: false, file: null, message: "skipped" } }),
    );
    await command();

    await page.send(init({ file: false, gitignore: false }));

    expect(openTextDocument).not.toHaveBeenCalled();
    expect(showInformationMessage.mock.calls[0]?.[0]).not.toContain("skipped");
  });

  it("treats an unchanged step as no failure", async () => {
    const { command, page } = setup(() =>
      result({
        gitignore: {
          status: "unchanged",
          changed: false,
          file: "/work/.gitignore",
          message: ".gitignore already holds _v-*",
        },
      }),
    );
    await command();

    await page.send(init());

    expect(contexts().at(-1)).toEqual(["variant.onboardingOpen", false]);
  });

  it("refuses an invalid prefix without calling init", async () => {
    const { command, page, calls } = setup();
    await command();

    await page.send(init({ prefix: "a/b" }));

    expect(calls).toEqual([]);
    expect(page.received.at(-1)).toMatchObject({ type: "failed", message: expect.stringContaining("path separator") });
  });

  it("stays open with the message of a failing step, after the other steps were written", async () => {
    const { command, page, setHasConfig, starts } = setup(() =>
      result({
        mise: { status: "failed", changed: false, file: "/work/mise.toml", message: "mise.toml is not valid TOML" },
      }),
    );
    await command();
    setHasConfig(true);

    await page.send(init());

    expect(page.received.at(-1)).toEqual({ type: "failed", message: "mise.toml is not valid TOML", hasConfig: true });
    expect(contexts().at(-1)).toEqual(["variant.onboardingOpen", true]);
    expect(starts).toHaveLength(1);
    expect(openTextDocument).not.toHaveBeenCalled();
  });

  it("stays open with the message of a failing init", async () => {
    const { command, page } = setup(() => {
      throw new Error("/work/variants.yaml already exists");
    });
    await command();

    await page.send(init());

    expect(page.received.at(-1)).toMatchObject({ type: "failed", message: "/work/variants.yaml already exists" });
    expect(page.received.at(-1)).not.toHaveProperty("trust");
  });

  it("offers Trust when Mise refuses an untrusted configuration, and runs Init again after it", async () => {
    let attempt = 0;
    const { command, page, calls, trusted } = setup(() => {
      attempt += 1;
      if (attempt === 1) {
        throw miseError(true);
      }
      return result();
    });
    await command();

    await page.send(init());
    expect(page.received.at(-1)).toMatchObject({
      type: "failed",
      message: "Mise failed in /work: not trusted",
      trust: "/work",
    });

    await page.send({ type: "trust" });

    expect(trusted).toEqual(["/work"]);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(contexts().at(-1)).toEqual(["variant.onboardingOpen", false]);
  });

  it("offers no Trust for another failure of Mise", async () => {
    const { command, page } = setup(() => {
      throw miseError(false);
    });
    await command();

    await page.send(init());

    expect(page.received.at(-1)).not.toHaveProperty("trust");
  });

  it("shows the message of a failing trust in the dialog and runs nothing again", async () => {
    const { command, page, calls, errors } = setup(() => {
      throw miseError(true);
    }, "trust refused");
    await command();
    await page.send(init());

    await page.send({ type: "trust" });

    expect(calls).toHaveLength(1);
    expect(errors).toEqual(["trust refused"]);
    expect(page.received.at(-1)).toMatchObject({ type: "failed", message: "trust refused" });
  });

  it("ignores messages it does not know", async () => {
    const { command, page, calls } = setup();
    await command();

    await page.send({ type: "nonsense" });
    await page.send("text");
    await page.send({ type: "trust" });

    expect(calls).toEqual([]);
  });
});
