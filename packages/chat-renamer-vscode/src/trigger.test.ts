import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installChatRenameHook } from "chat-renamer-api";
import * as vscode from "vscode";

import { vscodeMock } from "../test/vscode-mock";
import { type RegisterChatRenamerOptions, registerChatRenamer as register } from "./register";

type Disposable = { dispose(): void };

const quiet = { info: () => {}, warn: () => {}, error: () => {} };
describe("trigger", () => {
  let listeners: Array<(change: { sessionId: string; title?: string }) => void>;
  let registerUriHandler: ReturnType<typeof spyOn>;
  let created: Array<{ subscriptions: Disposable[] }>;
  let homeDir: string;

  // Always point user-scope hooks at a temporary home so tests never touch the real ~/.cursor.
  const registerChatRenamer = (ctx: vscode.ExtensionContext, options: RegisterChatRenamerOptions) =>
    register(ctx, { homeDir, ...options });

  const context = (extensionId: string) => {
    const ctx = {
      subscriptions: [] as Disposable[],
      extension: { id: extensionId, packageJSON: { identifier: { value: extensionId }, isBuiltin: false } },
      globalStorageUri: { fsPath: join(tmpdir(), "chat-renamer-test", "globalStorage", extensionId) },
    };
    created.push(ctx);
    return ctx as unknown as vscode.ExtensionContext;
  };

  const configure = (values: Record<string, unknown>) => {
    spyOn(vscode.workspace, "getConfiguration").mockImplementation((() => ({
      get: (key: string) => values[key],
    })) as unknown as typeof vscode.workspace.getConfiguration);
  };

  const hookScript = (prefix: string) => join(homeDir, ".cursor", "hooks", `${prefix}-chat-rename.sh`);

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), "chat-renamer-home-"));
    created = [];
    listeners = [];
    vscodeMock.env.appName = "Cursor";
    vscodeMock.extensions.getExtension = () => ({
      packageJSON: { identifier: { value: "anysphere.cursor-agent-host" }, isBuiltin: true, enabledApiProposals: [] },
    });
    vscodeMock.cursor.onDidChangeAgentHostSessionCatalogTitle = (listener) => {
      listeners.push(listener);
      return { dispose: () => {} };
    };
    registerUriHandler = spyOn(vscode.window, "registerUriHandler");
    registerUriHandler.mockClear();
    configure({});
  });

  afterEach(() => {
    // Releases the host-wide ownership claim so tests stay independent.
    for (const ctx of created) {
      for (const disposable of ctx.subscriptions) {
        disposable.dispose();
      }
    }
    vscodeMock.env.appName = undefined;
    vscodeMock.cursor.onDidChangeAgentHostSessionCatalogTitle = undefined;
  });

  describe("one active instance", () => {
    it("lets a single extension listen for title events and handle URIs", async () => {
      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log: quiet }).ready;

      expect(listeners).toHaveLength(1);
      expect(registerUriHandler).toHaveBeenCalledTimes(1);
    });

    it("keeps a second extension idle while the first one is active", async () => {
      await registerChatRenamer(context("variant.variant-vscode"), { log: quiet }).ready;
      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log: quiet }).ready;

      expect(listeners).toHaveLength(1);
      expect(registerUriHandler).toHaveBeenCalledTimes(1);
    });

    it("tells the log which extension owns renaming", async () => {
      const lines: string[] = [];
      const log = { info: (line: string) => lines.push(line), warn: () => {}, error: () => {} };
      await registerChatRenamer(context("variant.variant-vscode"), { log: quiet }).ready;

      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log }).ready;

      expect(lines.some((line) => line.includes("variant.variant-vscode") && line.includes("idle"))).toBe(true);
    });

    it("hands renaming to the next extension once the owner is disposed", async () => {
      const first = context("variant.variant-vscode");
      await registerChatRenamer(first, { log: quiet }).ready;
      for (const disposable of (first as unknown as { subscriptions: Disposable[] }).subscriptions) {
        disposable.dispose();
      }
      listeners.length = 0;

      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log: quiet }).ready;

      expect(listeners).toHaveLength(1);
    });

    describe("with the hook trigger", () => {
      beforeEach(() => configure({ trigger: "hook", hookScope: "user" }));

      it("installs the hook script for the active extension", async () => {
        await registerChatRenamer(context("variant.variant-vscode"), { commandPrefix: "owner", log: quiet }).ready;

        expect(existsSync(hookScript("owner"))).toBe(true);
      });

      it("does not install a hook for an idle extension", async () => {
        await registerChatRenamer(context("variant.variant-vscode"), { commandPrefix: "owner", log: quiet }).ready;

        await registerChatRenamer(context("variant.chat-renamer-vscode"), { commandPrefix: "idle", log: quiet }).ready;

        expect(existsSync(hookScript("idle"))).toBe(false);
      });

      it("removes a hook an idle extension wrote while it was active before", async () => {
        const cursorDir = join(homeDir, ".cursor");
        await installChatRenameHook({
          cursorDir,
          command: hookScript("idle"),
          script: "#!/bin/sh\n",
          scriptName: "idle-chat-rename.sh",
        });
        await registerChatRenamer(context("variant.variant-vscode"), { commandPrefix: "owner", log: quiet }).ready;

        await registerChatRenamer(context("variant.chat-renamer-vscode"), { commandPrefix: "idle", log: quiet }).ready;

        expect(existsSync(hookScript("idle"))).toBe(false);
        expect(readFileSync(join(cursorDir, "hooks.json"), "utf8")).not.toContain("idle-chat-rename.sh");
      });
    });
  });
});
