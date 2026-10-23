import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activationPatternSources, DEFAULT_ACTIVATION_PATTERNS, installChatRenameHook } from "chat-renamer-api";
import * as vscode from "vscode";

import { captureLog, quiet } from "../test/log";
import { vscodeMock } from "../test/vscode-mock";
import { type RegisterChatRenamerOptions, registerChatRenamer as register } from "./register";

type Disposable = { dispose(): void };

describe("trigger", () => {
  let listeners: Array<(change: { sessionId: string; title?: string }) => void>;
  let registerUriHandler: ReturnType<typeof spyOn>;
  let created: Array<{ subscriptions: Disposable[] }>;
  let homeDir: string;

  // Always point user-scope hooks at a temporary home so tests never touch the real ~/.cursor.
  const registerChatRenamer = (ctx: vscode.ExtensionContext, options: RegisterChatRenamerOptions) =>
    register(ctx, { homeDir, ...options });

  const memento = () => {
    const data = new Map<string, unknown>();
    return {
      get: <T>(key: string, fallback?: T) => (data.has(key) ? (data.get(key) as T) : fallback),
      update: async (key: string, value: unknown) => {
        data.set(key, value);
      },
    };
  };

  const context = (extensionId: string, globalState = memento()) => {
    const ctx = {
      subscriptions: [] as Disposable[],
      globalState,
      extension: { id: extensionId, packageJSON: { identifier: { value: extensionId }, isBuiltin: false } },
      globalStorageUri: { fsPath: join(tmpdir(), "chat-renamer-test", "globalStorage", extensionId) },
    };
    created.push(ctx);
    return ctx as unknown as vscode.ExtensionContext;
  };

  const configure = (values: Record<string, unknown>) => {
    // Everything configured here counts as set by the user.
    spyOn(vscode.workspace, "getConfiguration").mockImplementation((() => ({
      get: (key: string) => values[key],
      inspect: (key: string) => ({ globalValue: values[key] }),
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
    vscodeMock.extensions.all = [];
    vscodeMock.cursor.onDidChangeAgentHostSessionCatalogTitle = (listener) => {
      listeners.push(listener);
      return { dispose: () => {} };
    };
    registerUriHandler = spyOn(vscode.window, "registerUriHandler");
    registerUriHandler.mockClear();
    // Existing-chat renaming has its own listener and runs; the other suites switch it off to count only theirs.
    configure({ renameExistingDays: 0 });
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

    it("still listens when the agent host extension is not enumerable", async () => {
      vscodeMock.extensions.getExtension = () => undefined;
      const { log, entries } = captureLog();

      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log }).ready;

      expect(listeners).toHaveLength(1);
      expect(entries.filter((entry) => entry.level === "error")).toEqual([]);
      expect(
        entries
          .filter((entry) => entry.level === "warn")
          .map((entry) => entry.message)
          .join("\n"),
      ).not.toContain("is not installed");
    });

    it("keeps a second extension idle while the first one is active", async () => {
      await registerChatRenamer(context("variant.variant-vscode"), { log: quiet }).ready;
      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log: quiet }).ready;

      expect(listeners).toHaveLength(1);
      expect(registerUriHandler).toHaveBeenCalledTimes(1);
    });

    it("leaves chat-renamer idle when variant-worktrees is installed", async () => {
      vscodeMock.extensions.all = [{ id: "jubr.variant-worktrees" }];
      const captured = captureLog();
      const { log } = captured;

      await registerChatRenamer(context("jubr.chat-renamer"), { log }).ready;

      expect(listeners).toHaveLength(0);
      expect(registerUriHandler).not.toHaveBeenCalled();
      expect(captured.lines.some((line) => line.includes("jubr.variant-worktrees") && line.includes("idle"))).toBe(
        true,
      );

      await registerChatRenamer(context("jubr.variant-worktrees"), { log: quiet }).ready;

      expect(listeners).toHaveLength(1);
    });

    it("registers rename active chat on the idle instance too", async () => {
      const registerCommand = spyOn(vscode.commands, "registerCommand");
      try {
        await registerChatRenamer(context("variant.variant-vscode"), {
          log: quiet,
          commandPrefix: "variant",
        }).ready;
        await registerChatRenamer(context("variant.chat-renamer-vscode"), { log: quiet }).ready;

        const ids = registerCommand.mock.calls.map((call) => call[0]);
        expect(ids).toContain("variant.renameActiveChat");
        expect(ids).toContain("chat-renamer.renameActiveChat");
      } finally {
        registerCommand.mockRestore();
      }
    });

    it("tells the log which extension owns renaming", async () => {
      const captured = captureLog();
      const { log } = captured;
      await registerChatRenamer(context("variant.variant-vscode"), { log: quiet }).ready;

      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log }).ready;

      expect(captured.lines.some((line) => line.includes("variant.variant-vscode") && line.includes("idle"))).toBe(
        true,
      );
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

  describe("title event prompt lines", () => {
    const STARTED = Date.parse("2026-10-12T08:30:00.000Z");
    let renamed: Array<{ sessionId: string; title: string }>;
    let configListeners: Array<(event: { affectsConfiguration: (section: string) => boolean }) => void>;
    /** 12 lines; `/vw-spec-start abc` is on `requestLine`. */
    const prompt = (requestLine: number) =>
      Array.from({ length: 12 }, (_, index) =>
        index + 1 === requestLine ? "/vw-spec-start abc" : `filler ${index + 1}`,
      ).join("\n");

    const start = async (text: string, options: Partial<RegisterChatRenamerOptions> = {}) => {
      await registerChatRenamer(context("variant.chat-renamer-vscode"), {
        log: quiet,
        now: () => STARTED,
        readFirstPrompt: async () => ({ text, submittedAtMs: STARTED + 1_000 }),
        ...options,
      }).ready;
    };
    const titleEvent = async (sessionId: string) => {
      // The mock listener list keeps disposed subscriptions, so the live one is the last.
      listeners.at(-1)?.({ sessionId, title: "Some AI title" });
      await new Promise((resolve) => setTimeout(resolve, 5));
    };

    beforeEach(() => {
      renamed = [];
      configListeners = [];
      vscodeMock.cursor.projectAgentHostSessionTitle = async (sessionId, title) => {
        renamed.push({ sessionId, title });
      };
      spyOn(vscode.workspace, "onDidChangeConfiguration").mockImplementation(((listener: never) => {
        configListeners.push(listener);
        return { dispose: () => {} };
      }) as unknown as typeof vscode.workspace.onDidChangeConfiguration);
    });

    afterEach(() => {
      vscodeMock.cursor.projectAgentHostSessionTitle = undefined;
    });

    it("reads 10 lines by default", async () => {
      await start(prompt(10));
      await titleEvent("inside");

      expect(renamed).toEqual([{ sessionId: "inside", title: "abc" }]);
    });

    it("ignores a request on line 11 by default", async () => {
      await start(prompt(11));
      await titleEvent("beyond");

      expect(renamed).toEqual([]);
    });

    it("reads as many lines as variants.yaml asks for", async () => {
      await start(prompt(11), { fileConfig: { titleEventPromptLines: 20 } });
      await titleEvent("wide");

      expect(renamed).toEqual([{ sessionId: "wide", title: "abc" }]);
    });

    it("lets the editor setting win over variants.yaml", async () => {
      configure({ titleEventPromptLines: 1, renameExistingDays: 0 });

      await start(prompt(2), { fileConfig: { titleEventPromptLines: 20 } });
      await titleEvent("narrow");

      expect(renamed).toEqual([]);
    });

    it("applies a changed setting to the next chat without a reload", async () => {
      configure({ titleEventPromptLines: 10, renameExistingDays: 0 });
      await start(prompt(11));
      await titleEvent("before");

      configure({ titleEventPromptLines: 20, renameExistingDays: 0 });
      for (const listener of configListeners) {
        listener({ affectsConfiguration: () => true });
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
      await titleEvent("after");

      expect(renamed).toEqual([{ sessionId: "after", title: "abc" }]);
    });

    it("writes the lines it read to the log at trace level", async () => {
      const captured = captureLog();
      await start(prompt(11), { log: captured.log });
      await titleEvent("traced");

      const trace = captured.entries.filter((entry) => entry.level === "trace");
      expect(trace).toHaveLength(1);
      expect(trace[0]?.message).toContain("[title-event] prompt");
      expect(trace[0]?.message).toContain("lines=10 dropped=2");
    });
  });

  describe("title event decisions and failures", () => {
    const STARTED = Date.parse("2026-10-12T08:30:00.000Z");
    let renamed: Array<{ sessionId: string; title: string }>;
    let warnings: string[];
    let captured: ReturnType<typeof captureLog>;

    const start = async (text: string, submittedAtMs = STARTED + 1_000) => {
      await registerChatRenamer(context("variant.chat-renamer-vscode"), {
        log: captured.log,
        now: () => STARTED,
        readFirstPrompt: async () => ({ text, submittedAtMs }),
      }).ready;
    };
    const titleEvent = async (sessionId: string) => {
      listeners[0]?.({ sessionId, title: "Some AI title" });
      await new Promise((resolve) => setTimeout(resolve, 5));
    };
    const decisions = () => captured.entries.filter((entry) => entry.message.startsWith("[title-event] decision"));

    beforeEach(() => {
      captured = captureLog();
      renamed = [];
      warnings = [];
      vscodeMock.cursor.projectAgentHostSessionTitle = async (sessionId, title) => {
        renamed.push({ sessionId, title });
      };
      spyOn(vscode.window, "showWarningMessage").mockImplementation((async (...args: unknown[]) => {
        warnings.push(String(args[0]));
      }) as typeof vscode.window.showWarningMessage);
    });

    afterEach(() => {
      vscodeMock.cursor.projectAgentHostSessionTitle = undefined;
    });

    it("logs one decision with the matched pattern when it renames", async () => {
      await start("/vw-spec-start abc");
      await titleEvent("fresh");

      expect(decisions()).toEqual([
        {
          level: "info",
          message:
            '[title-event] decision session="fresh" matched=true pattern=2 decision="rename" reason="rename request" title="abc"',
        },
      ]);
    });

    it("logs a prompt without a request as not matched and shows no notification", async () => {
      await start("hello there");
      await titleEvent("fresh");

      expect(decisions()).toEqual([
        {
          level: "info",
          message: '[title-event] decision session="fresh" matched=false decision="ignore" reason="no rename request"',
        },
      ]);
      expect(warnings).toEqual([]);
    });

    it("logs a chat that existed before startup at debug level only", async () => {
      await start("/vw-spec-start abc", STARTED - 5_000);
      await titleEvent("old");

      expect(decisions().map((entry) => entry.level)).toEqual(["debug"]);
      expect(decisions()[0]?.message).toContain('reason="before startup"');
    });

    it("logs no decision for a later title event of the same chat", async () => {
      await start("/vw-spec-start abc");
      await titleEvent("fresh");
      await titleEvent("fresh");

      expect(decisions()).toHaveLength(1);
    });

    it("reports a failing rename in the log and in a notification with the reason", async () => {
      vscodeMock.cursor.projectAgentHostSessionTitle = async () => {
        throw new Error("gate closed");
      };
      await start("/vw-spec-start abc");
      await titleEvent("fresh");

      expect(decisions()).toEqual([
        {
          level: "error",
          message:
            '[title-event] decision session="fresh" decision="ignore" reason="title event failed" detail="gate closed"',
        },
      ]);
      expect(warnings).toEqual(["Chat rename failed for fresh: gate closed"]);
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

    it("derives the last path segment when no prefix is configured", async () => {
      await run("/vw-spec-iterate @/Users/me/_v-outer/_v-inner");

      expect(renamed).toEqual([{ sessionId: "fresh", title: "inner" }]);
    });

    it("ignores a prefix the host did not configure", async () => {
      await run("/vw-spec-iterate @/Users/me/vw/_v-my-slug", { fileConfig: { worktreePrefixes: ["_work-"] } });

      expect(renamed).toEqual([]);
    });

    it("honours the worktreePrefixes setting", async () => {
      configure({ worktreePrefixes: ["_work-"] });

      await run("/vw-spec-iterate @/Users/me/vw/_work-my-slug");

      expect(renamed).toEqual([{ sessionId: "fresh", title: "my-slug" }]);
    });

    it("lets the editor setting replace the prefixes a host supplies", async () => {
      configure({ worktreePrefixes: ["_work-"] });

      await run("/vw-spec-iterate @/Users/me/vw/_wt-my-slug", { fileConfig: { worktreePrefixes: ["_wt-"] } });

      expect(renamed).toEqual([]);
    });

    it("uses the prefixes from variants.yaml when the editor sets none", async () => {
      await run("/vw-spec-iterate @/Users/me/vw/_wt-my-slug", { fileConfig: { worktreePrefixes: ["_wt-"] } });

      expect(renamed).toEqual([{ sessionId: "fresh", title: "my-slug" }]);
    });

    it("uses the default path pattern when the editor empties the prefix list", async () => {
      configure({ worktreePrefixes: [] });

      await run("/vw-spec-iterate @/Users/me/vw/_wt-my-slug", { fileConfig: { worktreePrefixes: ["_wt-"] } });

      expect(renamed).toEqual([{ sessionId: "fresh", title: "my-slug" }]);
    });

    it("copies the worktree patterns into the hook script", async () => {
      configure({ trigger: "hook", hookScope: "user", worktreePrefixes: ["_work-"] });
      await registerChatRenamer(context("variant.chat-renamer-vscode"), { commandPrefix: "wt", log: quiet }).ready;

      const script = readFileSync(join(homeDir, ".cursor", "hooks", "wt-chat-rename.sh"), "utf8");
      const patterns = activationPatternSources(["_work-"], [...DEFAULT_ACTIVATION_PATTERNS]);
      expect(script).toContain(Buffer.from(JSON.stringify(patterns), "utf8").toString("base64"));
    });
  });

  describe("rename active chat", () => {
    const STARTED = Date.parse("2026-10-12T08:30:00.000Z");
    let renamed: Array<{ sessionId: string; title: string }>;
    let commands: Record<string, (...args: unknown[]) => unknown>;
    let warnings: unknown[][];
    let selected: unknown;
    let executeCommand: { mockRestore(): void };
    let registerCommand: { mockRestore(): void };
    let showWarningMessage: { mockRestore(): void };

    const start = (prompt: string) =>
      registerChatRenamer(context("variant.chat-renamer-vscode"), {
        log: quiet,
        now: () => STARTED,
        readFirstPrompt: async () => ({ text: prompt, submittedAtMs: STARTED - 60_000 }),
      }).ready;

    beforeEach(() => {
      renamed = [];
      commands = {};
      warnings = [];
      selected = ["chat-1"];
      configure({ renameExistingDays: 0 });
      vscodeMock.cursor.projectAgentHostSessionTitle = async (sessionId, title) => {
        renamed.push({ sessionId, title });
      };
      registerCommand = spyOn(vscode.commands, "registerCommand").mockImplementation(((id: string, callback: never) => {
        commands[id] = callback;
        return { dispose: () => {} };
      }) as unknown as typeof vscode.commands.registerCommand);
      executeCommand = spyOn(vscode.commands, "executeCommand").mockImplementation((async (command: string) => {
        if (command === "composer.getOrderedSelectedComposerIds") {
          return selected;
        }
        return undefined;
      }) as typeof vscode.commands.executeCommand);
      showWarningMessage = spyOn(vscode.window, "showWarningMessage").mockImplementation((async (
        ...args: unknown[]
      ) => {
        warnings.push(args);
        return undefined;
      }) as typeof vscode.window.showWarningMessage);
    });

    afterEach(() => {
      vscodeMock.cursor.projectAgentHostSessionTitle = undefined;
      vscodeMock.cursor.listAgentHostSessionCatalog = undefined;
      registerCommand.mockRestore();
      executeCommand.mockRestore();
      showWarningMessage.mockRestore();
    });

    it("renames a selected chat from an old pattern prompt when existing chats are off", async () => {
      await start("/vw-spec-start abc");

      await commands["chat-renamer.renameActiveChat"]?.();

      expect(renamed).toEqual([{ sessionId: "chat-1", title: "abc" }]);
    });

    it("tells the user when no chat is selected", async () => {
      selected = undefined;
      await start("/vw-spec-start abc");

      await commands["chat-renamer.renameActiveChat"]?.();

      expect(renamed).toEqual([]);
      expect(warnings).toHaveLength(1);
    });

    it("tells the user when the first prompt holds no rename request", async () => {
      await start("fix the build");

      await commands["chat-renamer.renameActiveChat"]?.();

      expect(renamed).toEqual([]);
      expect(warnings).toHaveLength(1);
    });

    it("does not warn when the current title already shares the base", async () => {
      vscodeMock.cursor.listAgentHostSessionCatalog = async () => [{ sessionId: "chat-1", title: "abc" }];
      await start("/vw-spec-start abc");

      await commands["chat-renamer.renameActiveChat"]?.();

      expect(renamed).toEqual([]);
      expect(warnings).toEqual([]);
    });
  });

  describe("existing chats", () => {
    const STARTED = Date.parse("2026-10-12T09:00:00.000Z");
    const DAY = 86_400_000;
    const names = { commandPrefix: "variant", configSection: "variant" };
    const SETTING = "variant.renameExistingDays";

    let renamed: Array<{ sessionId: string; title: string }>;
    let catalog: Array<{ sessionId: string; title?: string }>;
    let prompts: Record<string, { text: string; submittedAtMs?: number }>;
    let commands: Record<string, (...args: unknown[]) => unknown>;
    let configListeners: Array<(event: { affectsConfiguration: (section: string) => boolean }) => void>;
    let listCalls: number;

    const captured = captureLog();
    const log = captured.log;
    const emit = (change: { sessionId: string; title?: string }) => {
      for (const listener of [...listeners]) {
        listener(change);
      }
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 25));
    const aged = (text: string, ageMs: number) => ({ text, submittedAtMs: STARTED - ageMs });

    const start = async (state = memento(), extensionId = "variant.variant-vscode") => {
      const ctx = context(extensionId, state);
      await registerChatRenamer(ctx, {
        ...names,
        log,
        now: () => STARTED,
        readFirstPrompt: async (sessionId) => prompts[sessionId],
        existingChatsDelayMs: 0,
      }).ready;
      await settle();
      return ctx;
    };

    beforeEach(() => {
      configure({});
      renamed = [];
      catalog = [];
      prompts = {};
      captured.entries.length = 0;
      commands = {};
      configListeners = [];
      listCalls = 0;
      vscodeMock.cursor.projectAgentHostSessionTitle = async (sessionId, title) => {
        renamed.push({ sessionId, title });
      };
      vscodeMock.cursor.listAgentHostSessionCatalog = async () => {
        listCalls += 1;
        return catalog;
      };
      spyOn(vscode.commands, "registerCommand").mockImplementation(((id: string, callback: never) => {
        commands[id] = callback;
        return { dispose: () => {} };
      }) as unknown as typeof vscode.commands.registerCommand);
      spyOn(vscode.workspace, "onDidChangeConfiguration").mockImplementation(((listener: never) => {
        configListeners.push(listener);
        return { dispose: () => {} };
      }) as unknown as typeof vscode.workspace.onDidChangeConfiguration);
      spyOn(vscode.window, "showWarningMessage").mockClear();
      spyOn(vscode.window, "showInformationMessage").mockClear();
    });

    afterEach(() => {
      vscodeMock.cursor.projectAgentHostSessionTitle = undefined;
      vscodeMock.cursor.listAgentHostSessionCatalog = undefined;
    });

    const oldChats = () => {
      catalog = [
        { sessionId: "newest", title: "AI 3" },
        { sessionId: "oldest", title: "AI 1" },
        { sessionId: "middle", title: "AI 2" },
      ];
      prompts = {
        newest: aged("/vw-spec-start abc", 1 * DAY),
        oldest: aged("/vw-spec-start abc", 3 * DAY),
        middle: aged("/vw-spec-start abc", 2 * DAY),
      };
    };

    it("renames existing chats at startup, oldest first, by default", async () => {
      oldChats();

      await start();

      expect(renamed).toEqual([
        { sessionId: "oldest", title: "abc" },
        { sessionId: "middle", title: "abc2" },
        { sessionId: "newest", title: "abc3" },
      ]);
    });

    it("logs the trigger and the exact setting the run obeys", async () => {
      oldChats();

      await start();

      const started = captured.lines.find((line) => line.includes("run started"));
      expect(started?.startsWith("[existing-chats]")).toBe(true);
      expect(started).toContain("startup");
      expect(started).toContain(`${SETTING}=7`);
      expect(
        captured.lines.some((line) => line.startsWith("[existing-chats]") && line.includes("renamed oldest")),
      ).toBe(true);
      expect(captured.lines.some((line) => line.startsWith("[existing-chats]") && line.includes("renamed 3"))).toBe(
        true,
      );
      expect(
        captured.lines.some(
          (line) =>
            line.startsWith("[existing-chats]") && line.includes("existing chats plan") && line.includes('"abc"'),
        ),
      ).toBe(true);
    });

    it("does nothing and says why when renameExistingDays is 0", async () => {
      configure({ renameExistingDays: 0 });
      oldChats();

      await start();
      emit({ sessionId: "oldest", title: "AI" });
      await settle();

      expect(renamed).toEqual([]);
      expect(listCalls).toBe(0);
      expect(captured.lines.some((line) => line.startsWith("[existing-chats]") && line.includes(`${SETTING}=0`))).toBe(
        true,
      );
    });

    it("leaves chats older than the window alone", async () => {
      catalog = [{ sessionId: "stale", title: "AI" }];
      prompts = { stale: aged("/vw-spec-start abc", 8 * DAY) };

      await start();

      expect(renamed).toEqual([]);
    });

    it("renames older chats once the window is wide enough", async () => {
      configure({ renameExistingDays: 30 });
      catalog = [{ sessionId: "stale", title: "AI" }];
      prompts = { stale: aged("/vw-spec-start abc", 8 * DAY) };

      await start();

      expect(renamed).toEqual([{ sessionId: "stale", title: "abc" }]);
    });

    it("does not touch a chat an earlier run examined", async () => {
      oldChats();
      const state = memento();
      const first = await start(state);
      for (const disposable of (first as unknown as { subscriptions: Disposable[] }).subscriptions) {
        disposable.dispose();
      }
      renamed.length = 0;

      await start(state, "variant.chat-renamer-vscode");

      expect(renamed).toEqual([]);
    });

    it("renames a chat the catalog only lists after the title events settle", async () => {
      await start();
      expect(renamed).toEqual([]);
      catalog = [{ sessionId: "late", title: "AI" }];
      prompts = { late: aged("/vw-spec-start abc", DAY) };

      emit({ sessionId: "late", title: "AI" });
      await settle();

      expect(renamed).toEqual([{ sessionId: "late", title: "abc" }]);
      expect(captured.lines.some((line) => line.includes("run started") && line.includes("title events settled"))).toBe(
        true,
      );
    });

    it("lets only the active instance run", async () => {
      oldChats();
      await start(memento(), "variant.variant-vscode");
      await start(memento(), "variant.chat-renamer-vscode");

      expect(listCalls).toBe(1);
    });

    it("reconfigures without a reload when the setting changes", async () => {
      configure({ renameExistingDays: 0 });
      oldChats();
      await start();
      expect(renamed).toEqual([]);

      configure({ renameExistingDays: 7 });
      for (const listener of configListeners) {
        listener({ affectsConfiguration: (section) => section === names.configSection });
      }
      await settle();

      expect(renamed).toHaveLength(3);
      expect(captured.lines.some((line) => line.includes("run started") && line.includes("setting changed"))).toBe(
        true,
      );
    });

    it("re-examines recorded chats when the command runs", async () => {
      oldChats();
      await start();
      renamed.length = 0;

      await commands["variant.renameExistingChats"]?.();

      expect(renamed).toHaveLength(3);
      expect(captured.lines.some((line) => line.includes("run started") && line.includes("command"))).toBe(true);
    });

    it("tells the user which setting switched the command off", async () => {
      configure({ renameExistingDays: 0 });
      oldChats();
      await start();

      await commands["variant.renameExistingChats"]?.();

      expect(renamed).toEqual([]);
      const warning = (vscode.window.showWarningMessage as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(
        -1,
      );
      expect(String(warning?.[0])).toContain(`${SETTING}`);
    });

    describe("values from variants.yaml", () => {
      const startWith = async (fileConfig: Record<string, unknown>) => {
        await registerChatRenamer(context("variant.variant-vscode"), {
          ...names,
          log,
          now: () => STARTED,
          readFirstPrompt: async (sessionId) => prompts[sessionId],
          existingChatsDelayMs: 0,
          fileConfig,
        }).ready;
        await settle();
      };

      beforeEach(() => {
        configure({});
        catalog = [{ sessionId: "stale", title: "AI" }];
        prompts = { stale: aged("/vw-spec-start abc", 8 * DAY) };
      });

      it("widens the window when variants.yaml asks for more days", async () => {
        await startWith({ renameExistingDays: 30 });

        expect(renamed).toEqual([{ sessionId: "stale", title: "abc" }]);
        expect(captured.lines.some((line) => line.includes("run started") && line.includes(`${SETTING}=30`))).toBe(
          true,
        );
      });

      it("switches existing chats off when variants.yaml says 0", async () => {
        await startWith({ renameExistingDays: 0 });

        expect(renamed).toEqual([]);
        expect(
          captured.lines.some((line) => line.startsWith("[existing-chats]") && line.includes(`${SETTING}=0`)),
        ).toBe(true);
      });

      it("lets the editor setting win over variants.yaml", async () => {
        configure({ renameExistingDays: 0 });

        await startWith({ renameExistingDays: 30 });

        expect(renamed).toEqual([]);
      });
    });
  });

  describe("variant.enable", () => {
    const STARTED = Date.parse("2026-10-12T08:30:00.000Z");
    const names = { commandPrefix: "variant", configSection: "variant" };
    let renamed: Array<{ sessionId: string; title: string }>;

    beforeEach(() => {
      renamed = [];
      configure({ enable: false, renameExistingDays: 0 });
      vscodeMock.cursor.projectAgentHostSessionTitle = async (sessionId, title) => {
        renamed.push({ sessionId, title });
      };
    });

    afterEach(() => {
      vscodeMock.cursor.projectAgentHostSessionTitle = undefined;
    });

    it("does not rename on a title event when enable is false", async () => {
      await registerChatRenamer(context("jubr.variant-worktrees"), {
        ...names,
        log: quiet,
        now: () => STARTED,
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc", submittedAtMs: STARTED + 1_000 }),
      }).ready;

      listeners[0]?.({ sessionId: "fresh", title: "Some AI title" });
      await new Promise((resolve) => setTimeout(resolve, 5));

      expect(listeners).toHaveLength(0);
      expect(renamed).toEqual([]);
    });

    it("does not rename existing chats when enable is false", async () => {
      configure({ enable: false });
      vscodeMock.cursor.listAgentHostSessionCatalog = async () => [{ sessionId: "old", title: "AI" }];
      await registerChatRenamer(context("jubr.variant-worktrees"), {
        ...names,
        log: quiet,
        now: () => STARTED,
        existingChatsDelayMs: 0,
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc", submittedAtMs: STARTED - 86_400_000 }),
      }).ready;
      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(renamed).toEqual([]);
    });

    it("does not install a hook when enable is false", async () => {
      configure({ enable: false, trigger: "hook", hookScope: "user" });

      await registerChatRenamer(context("jubr.variant-worktrees"), { ...names, log: quiet }).ready;

      expect(existsSync(hookScript("variant"))).toBe(false);
    });

    it("removes a hook it installed once enable becomes false", async () => {
      const listeners: Array<(event: { affectsConfiguration: (section: string) => boolean }) => void> = [];
      spyOn(vscode.workspace, "onDidChangeConfiguration").mockImplementation(((listener: never) => {
        listeners.push(listener);
        return { dispose: () => {} };
      }) as unknown as typeof vscode.workspace.onDidChangeConfiguration);
      configure({ trigger: "hook", hookScope: "user", renameExistingDays: 0 });
      await registerChatRenamer(context("jubr.variant-worktrees"), { ...names, log: quiet }).ready;
      expect(existsSync(hookScript("variant"))).toBe(true);

      configure({ enable: false, trigger: "hook", hookScope: "user", renameExistingDays: 0 });
      for (const listener of listeners) {
        listener({ affectsConfiguration: (section) => section === "variant" });
      }
      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(existsSync(hookScript("variant"))).toBe(false);
    });

    it("tells the user and does not rename the active chat when enable is false", async () => {
      const commands: Record<string, (...args: unknown[]) => unknown> = {};
      const warnings: unknown[][] = [];
      spyOn(vscode.commands, "registerCommand").mockImplementation(((id: string, callback: never) => {
        commands[id] = callback;
        return { dispose: () => {} };
      }) as unknown as typeof vscode.commands.registerCommand);
      spyOn(vscode.commands, "executeCommand").mockImplementation((async () => [
        "chat-1",
      ]) as typeof vscode.commands.executeCommand);
      spyOn(vscode.window, "showWarningMessage").mockImplementation((async (...args: unknown[]) => {
        warnings.push(args);
        return undefined;
      }) as typeof vscode.window.showWarningMessage);
      vscodeMock.cursor.listAgentHostSessionCatalog = async () => [{ sessionId: "chat-1", title: "New Chat" }];

      await registerChatRenamer(context("jubr.variant-worktrees"), {
        ...names,
        log: quiet,
        now: () => STARTED,
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc", submittedAtMs: STARTED - 60_000 }),
      }).ready;
      await commands["variant.renameActiveChat"]?.();

      expect(renamed).toEqual([]);
      expect(String(warnings.at(-1)?.[0])).toContain("variant.enable");
      expect(String(warnings.at(-1)?.[0])).toContain("false");
    });

    it("starts renaming without a reload when enable changes from false to true", async () => {
      const configListeners: Array<(event: { affectsConfiguration: (section: string) => boolean }) => void> = [];
      spyOn(vscode.workspace, "onDidChangeConfiguration").mockImplementation(((listener: never) => {
        configListeners.push(listener);
        return { dispose: () => {} };
      }) as unknown as typeof vscode.workspace.onDidChangeConfiguration);
      configure({ enable: false });
      vscodeMock.cursor.listAgentHostSessionCatalog = async () => [{ sessionId: "old", title: "AI" }];
      await registerChatRenamer(context("jubr.variant-worktrees"), {
        ...names,
        log: quiet,
        now: () => STARTED,
        existingChatsDelayMs: 0,
        readFirstPrompt: async () => ({ text: "/vw-spec-start abc", submittedAtMs: STARTED - 86_400_000 }),
      }).ready;
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(renamed).toEqual([]);

      configure({ renameExistingDays: 7 });
      for (const listener of configListeners) {
        listener({ affectsConfiguration: (section) => section === "variant" });
      }
      await new Promise((resolve) => setTimeout(resolve, 25));

      expect(renamed).toEqual([{ sessionId: "old", title: "abc" }]);
    });
  });
});
