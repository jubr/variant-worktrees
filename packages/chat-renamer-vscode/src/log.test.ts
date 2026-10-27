import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as vscode from "vscode";

import { vscodeMock } from "../test/vscode-mock";
import { createExtensionLog, DEFAULT_LOG_CHANNEL_NAME } from "./log";

const context = () => ({ subscriptions: [] as unknown[] }) as unknown as vscode.ExtensionContext;

type Entry = { level: string; message: string };

describe("createExtensionLog", () => {
  let createOutputChannel: ReturnType<typeof spyOn>;
  let entries: Entry[];

  beforeEach(() => {
    entries = [];
    const at = (level: string) => (message: string) => {
      entries.push({ level, message });
    };
    createOutputChannel = spyOn(vscode.window, "createOutputChannel").mockImplementation((() => ({
      trace: at("trace"),
      debug: at("debug"),
      info: at("info"),
      warn: at("warn"),
      error: at("error"),
      dispose: () => {},
    })) as unknown as typeof vscode.window.createOutputChannel);
    vscodeMock.env.appName = "Cursor";
  });

  afterEach(() => {
    createOutputChannel.mockRestore();
    vscodeMock.env.appName = undefined;
  });

  it("creates the Chat Renamer channel as a log output channel", () => {
    createExtensionLog(context());

    expect(createOutputChannel).toHaveBeenCalledTimes(1);
    expect(createOutputChannel).toHaveBeenCalledWith("Chat Renamer", { log: true });
    expect(DEFAULT_LOG_CHANNEL_NAME).toBe("Chat Renamer");
  });

  it("uses the channel name a host extension passes and creates no other channel", () => {
    createExtensionLog(context(), "Variant Worktrees");

    expect(createOutputChannel.mock.calls).toEqual([["Variant Worktrees", { log: true }]]);
  });

  it("sends each level to the channel's own level method", () => {
    const log = createExtensionLog(context());

    log.trace("t");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    log.child("title-event").info("decision", { matched: true });

    expect(entries).toEqual([
      { level: "trace", message: "t" },
      { level: "debug", message: "d" },
      { level: "info", message: "i" },
      { level: "warn", message: "w" },
      { level: "error", message: "e" },
      { level: "info", message: "[title-event] decision matched=true" },
    ]);
  });

  it("disposes the channel with the extension", () => {
    const ctx = context();

    createExtensionLog(ctx);

    expect(ctx.subscriptions).toHaveLength(1);
  });

  it("logs nothing and creates no channel outside an editor host", () => {
    vscodeMock.env.appName = undefined;

    const log = createExtensionLog(context());

    expect(() => log.child("x").info("y")).not.toThrow();
    expect(createOutputChannel).not.toHaveBeenCalled();
  });
});
