import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log, setLogSink } from "variant-api";
import * as vscode from "vscode";
import { activate, deactivate } from "./extension.ts";

const registerCommand = spyOn(vscode.commands, "registerCommand");
const getCommands = spyOn(vscode.commands, "getCommands");
const executeCommand = spyOn(vscode.commands, "executeCommand");
const createOutputChannel = spyOn(vscode.window, "createOutputChannel");

const extensionContext: vscode.ExtensionContext = {
  subscriptions: [],
} as unknown as vscode.ExtensionContext;

interface StdioConfig {
  name: string;
  server: { command: string; args: string[]; env: Record<string, string> };
}

interface StdioDefinition {
  label: string;
  command: string;
  args: string[];
  env: Record<string, string | number | null>;
  version?: string;
  cwd?: { fsPath: string };
}

interface McpHost {
  cursor: {
    mcp: {
      registerServer?: (config: StdioConfig) => void;
      unregisterServer?: (name: string) => void;
    };
  };
  lm: {
    registerMcpServerDefinitionProvider?: (
      id: string,
      provider: { provideMcpServerDefinitions: () => StdioDefinition[] | Promise<StdioDefinition[]> },
    ) => { dispose: () => void };
  };
}

const host = vscode as unknown as McpHost;

const mcpContext = (extensionPath: string): vscode.ExtensionContext =>
  ({ subscriptions: [], extensionPath }) as unknown as vscode.ExtensionContext;

const probeCallback = () => {
  activate(extensionContext);
  const call = registerCommand.mock.calls.find((entry) => entry[0] === "variant.probeCursorCommands");
  if (!call) {
    throw new Error("probe command was not registered");
  }
  return call[1] as () => Promise<void>;
};

const captureProbeChannel = () => {
  const lines: string[] = [];
  let channelName = "";
  let shown = false;
  createOutputChannel.mockImplementation((name: string) => {
    channelName = name;
    return {
      clear: () => {
        lines.length = 0;
      },
      appendLine: (line: string) => {
        lines.push(line);
      },
      show: () => {
        shown = true;
      },
    };
  });
  return {
    lines,
    channelName: () => channelName,
    shown: () => shown,
  };
};

describe("extension", () => {
  beforeEach(() => {
    registerCommand.mockClear();
    getCommands.mockClear();
    executeCommand.mockClear();
    createOutputChannel.mockClear();
    extensionContext.subscriptions.length = 0;
    vscode.workspace.workspaceFolders = undefined;
    host.cursor.mcp.registerServer = undefined;
    host.cursor.mcp.unregisterServer = undefined;
    host.lm.registerMcpServerDefinitionProvider = undefined;
  });

  describe("activation", () => {
    it("registers the rename chat commands", () => {
      activate(extensionContext);

      const ids = registerCommand.mock.calls.map((entry) => entry[0]);
      expect(ids).toContain("variant.renameChat");
      expect(ids).toContain("variant.renameChatFromPrompt");
    });

    it("registers the Cursor command probe", () => {
      activate(extensionContext);

      const ids = registerCommand.mock.calls.map((call) => call[0]);
      expect(ids).toContain("variant.probeCursorCommands");
    });

    it("reports matching command ids in Cursor Command Probe", async () => {
      const channel = captureProbeChannel();
      getCommands.mockImplementation(async () => ["composer.renameChat", "agent.setLabel"]);

      await probeCallback()();

      expect(getCommands).toHaveBeenCalledWith(true);
      expect(channel.channelName()).toEqual("Cursor Command Probe");
      expect(channel.lines).toEqual(["agent.setLabel", "composer.renameChat"]);
      expect(channel.shown()).toBe(true);
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it("replaces the previous probe report", async () => {
      const channel = captureProbeChannel();
      const commandLists = [["composer.renameChat"], ["agent.updateLabel"]];
      let call = 0;
      getCommands.mockImplementation(async () => commandLists[call++] ?? []);

      const run = probeCallback();
      await run();
      await run();

      expect(channel.lines).toEqual(["agent.updateLabel"]);
    });

    it("reports the empty-result line when nothing matches", async () => {
      const channel = captureProbeChannel();
      getCommands.mockImplementation(async () => ["cursor.openChat"]);

      await probeCallback()();

      expect(channel.lines).toEqual(["No rename-like commands found in this build."]);
      expect(executeCommand).not.toHaveBeenCalled();
    });

    it("contributes the probe command, which activates the extension without an explicit event", () => {
      const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
        activationEvents: string[];
        contributes: { commands: { command: string; title: string }[] };
      };
      const command = manifest.contributes.commands.find((entry) => entry.command === "variant.probeCursorCommands");

      // VS Code activates on every contributed command, so no onCommand events are listed.
      expect(manifest.activationEvents.filter((event) => event.startsWith("onCommand:"))).toEqual([]);
      expect(command?.title).toEqual("Variant: Probe Cursor Chat Commands");
    });

    it("logs to a Variant Worktrees log channel, which Show Logs lists", () => {
      const noop = () => {};
      createOutputChannel.mockImplementation((() => ({
        trace: noop,
        debug: noop,
        info: noop,
        warn: noop,
        error: noop,
        dispose: noop,
      })) as unknown as typeof vscode.window.createOutputChannel);
      vscode.env.appName = "Cursor";
      try {
        activate({
          subscriptions: [],
          globalState: { get: () => undefined, update: async () => {} },
          extension: { id: "jubr.variant-worktrees", packageJSON: { identifier: { value: "jubr.variant-worktrees" } } },
          globalStorageUri: { fsPath: "/tmp/variant-worktrees-test" },
        } as unknown as vscode.ExtensionContext);
      } finally {
        vscode.env.appName = undefined;
      }

      expect(createOutputChannel.mock.calls).toEqual([["Variant Worktrees", { log: true }]]);
    });

    it("writes a contact warning to the Variant Worktrees channel and opens no second channel", () => {
      const warnings: string[] = [];
      const noop = () => {};
      createOutputChannel.mockImplementation(((name: string) => ({
        name,
        trace: noop,
        debug: noop,
        info: noop,
        warn: (message: string) => warnings.push(`${name}:${message}`),
        error: noop,
        dispose: noop,
      })) as unknown as typeof vscode.window.createOutputChannel);
      vscode.env.appName = "Cursor";
      const message = "Cannot contact postgres database app at 127.0.0.1:5432";
      try {
        activate({
          subscriptions: [],
          globalState: { get: () => undefined, update: async () => {} },
          extension: { id: "jubr.variant-worktrees", packageJSON: { identifier: { value: "jubr.variant-worktrees" } } },
          globalStorageUri: { fsPath: "/tmp/variant-worktrees-test" },
        } as unknown as vscode.ExtensionContext);
        log("warn", message);
      } finally {
        vscode.env.appName = undefined;
        setLogSink(undefined);
      }

      expect(warnings).toEqual([`Variant Worktrees:${message}`]);
      expect(createOutputChannel.mock.calls.map((call) => call[0])).toEqual(["Variant Worktrees"]);
    });

    it("activates on startup so the log channel is listed without running a command", () => {
      const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
        activationEvents: string[];
      };

      expect(manifest.activationEvents).toContain("onStartupFinished");
    });

    it("registers the Variants view and its commands for the first workspace folder", () => {
      const createTreeView = spyOn(vscode.window, "createTreeView");
      createTreeView.mockClear();
      vscode.workspace.workspaceFolders = [{ uri: { fsPath: "/tmp/variant-vscode-no-config" } }];
      try {
        activate(extensionContext);
      } finally {
        vscode.workspace.workspaceFolders = undefined;
      }

      const ids = registerCommand.mock.calls.map((entry) => entry[0]);
      expect(createTreeView.mock.calls.map((call) => call[0])).toEqual(["variant.variants", "variant.worktrees"]);
      expect(ids.filter((id) => id === "variant.play")).toEqual(["variant.play"]);
      expect(ids).toEqual(expect.arrayContaining(["variant.play", "variant.stop", "variant.implode"]));
    });

    it("registers no Variants view without a workspace folder", () => {
      const createTreeView = spyOn(vscode.window, "createTreeView");
      createTreeView.mockClear();

      activate(extensionContext);

      expect(createTreeView).not.toHaveBeenCalled();
    });

    it("does not register a hello world command", () => {
      activate(extensionContext);

      const ids = registerCommand.mock.calls.map((entry) => entry[0]);
      expect(ids).not.toContain("variant-worktrees.helloworld");
    });
  });
});

/**
 * Specification: openspec/specs/variant-vscode/mcp-registration/spec.md
 */
describe("mcp registration", () => {
  const folders = [{ uri: { fsPath: "/repo" } }, { uri: { fsPath: "/other" } }];
  const scriptArgs = (extensionPath: string, folder: string): string[] => [
    join(extensionPath, "dist", "mcp.mjs"),
    "--cwd",
    folder,
  ];

  beforeEach(() => {
    vscode.workspace.workspaceFolders = undefined;
    host.cursor.mcp.registerServer = undefined;
    host.cursor.mcp.unregisterServer = undefined;
    host.lm.registerMcpServerDefinitionProvider = undefined;
  });

  it("registers one Cursor server for the first folder and unregisters it once", async () => {
    const registered: StdioConfig[] = [];
    const unregistered: string[] = [];
    let providers = 0;
    host.cursor.mcp.registerServer = (config) => {
      registered.push(config);
    };
    host.cursor.mcp.unregisterServer = (name) => {
      unregistered.push(name);
    };
    host.lm.registerMcpServerDefinitionProvider = () => {
      providers += 1;
      return { dispose: () => {} };
    };
    vscode.workspace.workspaceFolders = folders;

    await activate(mcpContext("/ext"));
    await deactivate();
    await deactivate();

    expect(registered).toEqual([
      {
        name: "variant",
        server: {
          command: process.execPath,
          args: scriptArgs("/ext", "/repo"),
          env: { ELECTRON_RUN_AS_NODE: "1" },
        },
      },
    ]);
    expect(providers).toBe(0);
    expect(unregistered).toEqual(["variant"]);
  });

  it("registers the VS Code provider when Cursor's API is absent", async () => {
    const extensionPath = mkdtempSync(join("/tmp", "variant-mcp-ext-"));
    writeFileSync(join(extensionPath, "package.json"), JSON.stringify({ version: "9.9.9" }));
    let providerId = "";
    let definitions: StdioDefinition[] = [];
    const seen: Array<{ provide: () => StdioDefinition[] | Promise<StdioDefinition[]> }> = [];
    host.lm.registerMcpServerDefinitionProvider = (id, provider) => {
      providerId = id;
      const disposable = { dispose: () => {}, provide: () => provider.provideMcpServerDefinitions() };
      seen.push(disposable);
      return disposable;
    };
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: "/repo" } }];
    try {
      await activate(mcpContext(extensionPath));
      definitions = (await seen[0]?.provide()) ?? [];
    } finally {
      rmSync(extensionPath, { recursive: true, force: true });
      vscode.workspace.workspaceFolders = undefined;
    }

    expect(providerId).toBe("variant");
    expect(definitions).toEqual([
      expect.objectContaining({
        label: "variant",
        command: process.execPath,
        args: scriptArgs(extensionPath, "/repo"),
        env: { ELECTRON_RUN_AS_NODE: "1" },
        version: "9.9.9",
        cwd: expect.objectContaining({ fsPath: "/repo" }),
      }),
    ]);
  });

  it("registers nothing without a workspace folder", async () => {
    let cursorCalls = 0;
    let providerCalls = 0;
    host.cursor.mcp.registerServer = () => {
      cursorCalls += 1;
    };
    host.lm.registerMcpServerDefinitionProvider = () => {
      providerCalls += 1;
      return { dispose: () => {} };
    };

    await activate(extensionContext);

    expect(cursorCalls).toBe(0);
    expect(providerCalls).toBe(0);
  });

  it("activates when the host has neither registration API", async () => {
    vscode.workspace.workspaceFolders = folders;

    await expect(activate(mcpContext("/ext"))).resolves.toBeUndefined();
  });

  it("registers in a workspace that has no mcp.json and leaves that file absent", async () => {
    const directory = mkdtempSync(join("/tmp", "variant-mcp-ws-"));
    const registered: StdioConfig[] = [];
    host.cursor.mcp.registerServer = (config) => {
      registered.push(config);
    };
    vscode.workspace.workspaceFolders = [{ uri: { fsPath: directory } }];
    try {
      await activate(mcpContext("/ext"));
      expect(existsSync(join(directory, "mcp.json"))).toBe(false);
      expect(registered).toHaveLength(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      vscode.workspace.workspaceFolders = undefined;
    }
  });

  it("does not import the bundled MCP entry", () => {
    const source = readFileSync(new URL("./extension.ts", import.meta.url), "utf8");
    expect(source).not.toContain("mcp-entry");
  });
});
