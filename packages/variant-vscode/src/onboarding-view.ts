import { randomBytes } from "node:crypto";
import type { InitResult } from "variant-api";
import * as vscode from "vscode";
import { type MiseGuard, miseFailureOf } from "./mise-guard.ts";
import { buildOnboardingHtml, type DialogMessage, type HostMessage, prefixProblem } from "./onboarding-html.ts";
import type { ActivityLog } from "./variants-actions.ts";
import { type LoadClient, messageOf } from "./variants-client.ts";
import type { VariantsStore } from "./variants-store.ts";

/**
 * Specification: openspec/changes/variant-init-onboarding/specs/variant-vscode/onboarding/spec.md
 * (Onboarding command and dialog)
 */

export const ONBOARDING_VIEW_ID = "variant.onboarding";
export const ONBOARDING_OPEN_CONTEXT = "variant.onboardingOpen";
export const ONBOARDING_INIT_COMMAND = "variant.onboardingInit";
const TREE_FOCUS = "variant.variants.focus";
/** How often the focused section is asked to grow: the host stops where it cannot give more. */
const GROW_STEPS = 10;

export interface OnboardingDeps {
  extensionUri: vscode.Uri;
  loadClient: LoadClient;
  store: VariantsStore;
  guard: MiseGuard;
  /** Whether a `variants.yaml` is found for the workspace root. */
  hasConfig: () => boolean;
  log?: ActivityLog;
  nonce?: () => string;
}

export interface Onboarding {
  /** Shows the dialog in the Variant Worktrees section and focuses it; with the dialog open, only focuses. */
  open(): Promise<void>;
  isOpen(): boolean;
}

type InitRequest = Extract<DialogMessage, { type: "init" }>;

const setContext = (key: string, value: boolean): Thenable<unknown> =>
  vscode.commands.executeCommand("setContext", key, value);

const isDialogMessage = (value: unknown): value is DialogMessage =>
  typeof value === "object" && value !== null && typeof (value as { type?: unknown }).type === "string";

/** What each step did, for the confirmation: skipped steps are left out. */
const summarize = (result: InitResult): string => {
  const parts = [
    result.file === null ? undefined : "wrote variants.yaml",
    result.gitignore.status === "skipped" ? undefined : result.gitignore.message,
    result.mise.status === "skipped" ? undefined : result.mise.message,
  ].filter((part): part is string => part !== undefined);
  return `Variant initialized: ${parts.join("; ")}`;
};

export const registerOnboarding = (context: vscode.ExtensionContext, deps: OnboardingDeps): Onboarding => {
  let open = false;
  let current: { post: (message: HostMessage) => void } | undefined;
  let lastRequest: InitRequest | undefined;
  let trustDirectory: string | undefined;

  const post = (message: HostMessage): void => current?.post(message);

  const close = async (): Promise<void> => {
    open = false;
    await setContext(ONBOARDING_OPEN_CONTEXT, false);
    await vscode.commands.executeCommand(TREE_FOCUS);
    void deps.store.start();
  };

  const fail = (message: string, trust?: string): void => {
    trustDirectory = trust;
    post({ type: "failed", message, hasConfig: deps.hasConfig(), ...(trust === undefined ? {} : { trust }) });
  };

  const showFile = async (file: string): Promise<void> => {
    const document = await vscode.workspace.openTextDocument(file);
    await vscode.window.showTextDocument(document);
  };

  const run = async (request: InitRequest): Promise<void> => {
    lastRequest = request;
    const problem = prefixProblem(request.prefix);
    if (problem !== undefined) {
      fail(problem);
      return;
    }
    deps.log?.info("init", { prefix: request.prefix });
    let result: InitResult;
    try {
      const client = await deps.loadClient();
      result = await client.init({
        prefix: request.prefix,
        file: request.file,
        gitignore: request.gitignore,
        mise: request.mise,
      });
    } catch (error) {
      deps.log?.error("init failed", error);
      const failure = miseFailureOf(error);
      if (failure === undefined) {
        fail(messageOf(error));
      } else {
        fail(
          `Mise failed in ${failure.directory}: ${failure.detail}`,
          failure.untrusted ? failure.directory : undefined,
        );
      }
      return;
    }
    void deps.store.start();
    if (result.mise.status === "failed") {
      fail(result.mise.message);
      return;
    }
    await close();
    if (result.file !== null) {
      await showFile(result.file);
    }
    void vscode.window.showInformationMessage(summarize(result));
  };

  const onMessage = async (message: unknown): Promise<void> => {
    if (!isDialogMessage(message)) {
      return;
    }
    switch (message.type) {
      case "cancel":
        await close();
        return;
      case "init":
        await run(message);
        return;
      case "trust": {
        if (trustDirectory === undefined || lastRequest === undefined) {
          return;
        }
        const failure = await deps.guard.trust(trustDirectory);
        if (failure !== undefined) {
          fail(failure);
          return;
        }
        await run(lastRequest);
        return;
      }
    }
  };

  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView: (view) => {
      const media = vscode.Uri.joinPath(deps.extensionUri, "media");
      view.webview.options = { enableScripts: true, localResourceRoots: [media] };
      view.webview.html = buildOnboardingHtml({
        nonce: (deps.nonce ?? (() => randomBytes(16).toString("base64url")))(),
        cspSource: view.webview.cspSource,
        iconUri: view.webview.asWebviewUri(vscode.Uri.joinPath(media, "icon-128.png")).toString(),
        hasConfig: deps.hasConfig(),
      });
      const target = { post: (message: HostMessage) => void view.webview.postMessage(message) };
      current = target;
      const subscription = view.webview.onDidReceiveMessage((message) => onMessage(message));
      view.onDidDispose(() => {
        subscription.dispose();
        if (current === target) {
          current = undefined;
        }
      });
    },
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ONBOARDING_VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand(ONBOARDING_INIT_COMMAND, () => controller.open()),
    {
      dispose: () => {
        open = false;
        void setContext(ONBOARDING_OPEN_CONTEXT, false);
      },
    },
  );

  const controller: Onboarding = {
    open: async () => {
      if (!open) {
        open = true;
        lastRequest = undefined;
        trustDirectory = undefined;
        await setContext(ONBOARDING_OPEN_CONTEXT, true);
      }
      await vscode.commands.executeCommand(`${ONBOARDING_VIEW_ID}.focus`);
      for (let step = 0; step < GROW_STEPS; step += 1) {
        await vscode.commands.executeCommand("workbench.action.increaseViewSize");
      }
    },
    isOpen: () => open,
  };
  return controller;
};
