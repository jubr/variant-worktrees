import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activationPatternSources, DEFAULT_ACTIVATION_PATTERNS, installChatRenameHook } from "chat-renamer-api";
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
      const errors: unknown[][] = [];
      const warnings: string[] = [];
      const log = {
        info: () => {},
        warn: (line: string) => warnings.push(line),
        error: (...args: unknown[]) => errors.push(args),
      };

      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log }).ready;

      expect(listeners).toHaveLength(1);
      expect(errors).toEqual([]);
      expect(warnings.join("\n")).not.toContain("is not installed");
    });

    it("keeps a second extension idle while the first one is active", async () => {
      await registerChatRenamer(context("variant.variant-vscode"), { log: quiet }).ready;
      await registerChatRenamer(context("variant.chat-renamer-vscode"), { log: quiet }).ready;

      expect(listeners).toHaveLength(1);
      expect(registerUriHandler).toHaveBeenCalledTimes(1);
    });

    it("leaves chat-renamer idle when variant-worktrees is installed", async () => {
      vscodeMock.extensions.all = [{ id: "jubr.variant-worktrees" }];
      const lines: string[] = [];
      const log = { info: (line: string) => lines.push(line), warn: () => {}, error: () => {} };

      await registerChatRenamer(context("jubr.chat-renamer"), { log }).ready;

      expect(listeners).toHaveLength(0);
      expect(registerUriHandler).not.toHaveBeenCalled();
      expect(lines.some((line) => line.includes("jubr.variant-worktrees") && line.includes("idle"))).toBe(true);

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
    const names = { commandPrefix: "variant", configSection: "variant-worktrees.chatRename" };
    const SETTING = "variant-worktrees.chatRename.renameExistingDays";

    let renamed: Array<{ sessionId: string; title: string }>;
    let catalog: Array<{ sessionId: string; title?: string }>;
    let prompts: Record<string, { text: string; submittedAtMs?: number }>;
    let lines: string[];
    let commands: Record<string, (...args: unknown[]) => unknown>;
    let configListeners: Array<(event: { affectsConfiguration: (section: string) => boolean }) => void>;
    let listCalls: number;

    const log = {
      info: (line: string) => lines.push(line),
      warn: (line: string) => lines.push(line),
      error: (line: string) => lines.push(line),
    };
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
      lines = [];
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

      const started = lines.find((line) => line.includes("run started"));
      expect(started?.startsWith("[existing-chats]")).toBe(true);
      expect(started).toContain("startup");
      expect(started).toContain(`${SETTING}=7`);
      expect(lines.some((line) => line.startsWith("[existing-chats]") && line.includes("renamed oldest"))).toBe(true);
      expect(lines.some((line) => line.startsWith("[existing-chats]") && line.includes("renamed 3"))).toBe(true);
      expect(
        lines.some(
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
      expect(lines.some((line) => line.startsWith("[existing-chats]") && line.includes(`${SETTING}=0`))).toBe(true);
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
      expect(lines.some((line) => line.includes("run started") && line.includes("title events settled"))).toBe(true);
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
      expect(lines.some((line) => line.includes("run started") && line.includes("setting changed"))).toBe(true);
    });

    it("re-examines recorded chats when the command runs", async () => {
      oldChats();
      await start();
      renamed.length = 0;

      await commands["variant.renameExistingChats"]?.();

      expect(renamed).toHaveLength(3);
      expect(lines.some((line) => line.includes("run started") && line.includes("command"))).toBe(true);
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
        expect(lines.some((line) => line.includes("run started") && line.includes(`${SETTING}=30`))).toBe(true);
      });

      it("switches existing chats off when variants.yaml says 0", async () => {
        await startWith({ renameExistingDays: 0 });

        expect(renamed).toEqual([]);
        expect(lines.some((line) => line.startsWith("[existing-chats]") && line.includes(`${SETTING}=0`))).toBe(true);
      });

      it("lets the editor setting win over variants.yaml", async () => {
        configure({ renameExistingDays: 0 });

        await startWith({ renameExistingDays: 30 });

        expect(renamed).toEqual([]);
      });
    });
  });
});
