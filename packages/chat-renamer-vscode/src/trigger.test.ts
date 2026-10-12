import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ACTIVATION_PATTERNS, installChatRenameHook, worktreeActivationPatterns } from "chat-renamer-api";
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

  describe("realtime renaming only", () => {
    const STARTED = Date.parse("2026-10-12T08:30:00.000Z");
    let renamed: Array<{ sessionId: string; title: string }>;
    let prompts: Record<string, { text: string; submittedAtMs?: number }>;

    const start = async () => {
      await registerChatRenamer(context("variant.chat-renamer-vscode"), {
        log: quiet,
        now: () => STARTED,
        readFirstPrompt: async (sessionId) => prompts[sessionId],
      }).ready;
    };
    const titleEvent = async (sessionId: string) => {
      listeners[0]?.({ sessionId, title: "Some AI title" });
      await new Promise((resolve) => setTimeout(resolve, 5));
    };

    beforeEach(() => {
      renamed = [];
      prompts = {};
      vscodeMock.cursor.projectAgentHostSessionTitle = async (sessionId, title) => {
        renamed.push({ sessionId, title });
      };
    });

    afterEach(() => {
      vscodeMock.cursor.projectAgentHostSessionTitle = undefined;
    });

    it("renames a chat whose first prompt was sent after the renamer started", async () => {
      prompts.fresh = { text: "/chat-rename wanted", submittedAtMs: STARTED + 1_000 };
      await start();

      await titleEvent("fresh");

      expect(renamed).toEqual([{ sessionId: "fresh", title: "wanted" }]);
    });

    it("ignores chats that already existed when the editor loaded them", async () => {
      prompts.old = { text: "/chat-rename wanted", submittedAtMs: STARTED - 5_000 };
      await start();

      await titleEvent("old");

      expect(renamed).toEqual([]);
    });

    it("handles each chat on its first title event only", async () => {
      prompts.fresh = { text: "/chat-rename wanted", submittedAtMs: STARTED + 1_000 };
      await start();

      await titleEvent("fresh");
      await titleEvent("fresh");

      expect(renamed).toHaveLength(1);
    });
  });

  describe("dragged-in worktree folders", () => {
    const STARTED = Date.parse("2026-10-12T08:30:00.000Z");
    let renamed: Array<{ sessionId: string; title: string }>;

    const run = async (prompt: string, options: Partial<RegisterChatRenamerOptions> = {}) => {
      await registerChatRenamer(context("variant.chat-renamer-vscode"), {
        log: quiet,
        now: () => STARTED,
        readFirstPrompt: async () => ({ text: prompt, submittedAtMs: STARTED + 1_000 }),
        ...options,
      }).ready;
      listeners[0]?.({ sessionId: "fresh", title: "Some AI title" });
      await new Promise((resolve) => setTimeout(resolve, 5));
    };

    beforeEach(() => {
      renamed = [];
      vscodeMock.cursor.projectAgentHostSessionTitle = async (sessionId, title) => {
        renamed.push({ sessionId, title });
      };
    });

    afterEach(() => {
      vscodeMock.cursor.projectAgentHostSessionTitle = undefined;
    });

    it("derives the slug with the default _v prefix", async () => {
      await run("/vw-spec-iterate @/Users/me/vw/_v-cursor-chat-win-rename");

      expect(renamed).toEqual([{ sessionId: "fresh", title: "cursor-chat-win-rename" }]);
    });

    it("honours the worktreePrefixes setting", async () => {
      configure({ worktreePrefixes: ["_work"] });

      await run("/vw-spec-iterate @/Users/me/vw/_work-my-slug");

      expect(renamed).toEqual([{ sessionId: "fresh", title: "my-slug" }]);
    });

    it("adds the prefixes a host extension supplies", async () => {
      await run("/vw-spec-iterate @/Users/me/vw/_work-my-slug", { extraWorktreePrefixes: ["_work"] });

      expect(renamed).toEqual([{ sessionId: "fresh", title: "my-slug" }]);
    });

    it("derives nothing when the prefix list is empty", async () => {
      configure({ worktreePrefixes: [] });

      await run("/vw-spec-iterate @/Users/me/vw/_v-my-slug");

      expect(renamed).toEqual([]);
    });

    it("copies the worktree patterns into the hook script", async () => {
      configure({ trigger: "hook", hookScope: "user", worktreePrefixes: ["_work"] });
      await registerChatRenamer(context("variant.chat-renamer-vscode"), { commandPrefix: "wt", log: quiet }).ready;

      const script = readFileSync(join(homeDir, ".cursor", "hooks", "wt-chat-rename.sh"), "utf8");
      const patterns = [...worktreeActivationPatterns(["_work"]), ...DEFAULT_ACTIVATION_PATTERNS];
      expect(script).toContain(Buffer.from(JSON.stringify(patterns), "utf8").toString("base64"));
    });
  });
});
