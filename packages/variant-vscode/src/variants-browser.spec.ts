import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as vscode from "vscode";
import { openInBrowser } from "./variants-browser.ts";
import { record } from "./variants-test-support.ts";

const openExternal = spyOn(vscode.env, "openExternal");
const showInformationMessage = spyOn(vscode.window, "showInformationMessage");
const writeText = spyOn(vscode.env.clipboard, "writeText");

const running = record("main", {
  watches: { "variant-ui": { alive: true, pid: 1, url: "http://ui.vw.localhost:62100" } },
});

beforeEach(() => {
  openExternal.mockClear();
  showInformationMessage.mockClear();
  writeText.mockClear();
  openExternal.mockImplementation((async () => true) as never);
  showInformationMessage.mockImplementation((async () => undefined) as never);
  writeText.mockImplementation((async () => {}) as never);
});

describe("open the web page", () => {
  it("opens the URL of the running server, with its token, in the external browser", async () => {
    await openInBrowser({ records: () => [running], readToken: () => "t0ken" });

    expect(String(openExternal.mock.calls[0]?.[0])).toBe("http://ui.vw.localhost:62100/?token=t0ken");
  });

  it("opens no browser without a server, and names the command with a copy button", async () => {
    await openInBrowser({ records: () => [record("main")], readToken: () => undefined });

    expect(openExternal).not.toHaveBeenCalled();
    const [message, ...buttons] = showInformationMessage.mock.calls[0] as string[];
    expect(message).toContain("variant ui --detach");
    expect(buttons).toEqual(["Copy command"]);
  });

  it("copies the command when the button is pressed", async () => {
    showInformationMessage.mockImplementation((async () => "Copy command") as never);

    await openInBrowser({ records: () => [], readToken: () => undefined });

    expect(writeText).toHaveBeenCalledWith("variant ui --detach");
  });

  it("treats a recorded server whose process is gone as no server", async () => {
    const stale = record("main", {
      watches: { "variant-ui": { alive: false, url: "http://ui.vw.localhost:62100" } },
    });

    await openInBrowser({ records: () => [stale], readToken: () => "t0ken" });

    expect(openExternal).not.toHaveBeenCalled();
    expect(showInformationMessage).toHaveBeenCalled();
  });

  it("treats a server without a token file as no server", async () => {
    await openInBrowser({ records: () => [running], readToken: () => undefined });

    expect(openExternal).not.toHaveBeenCalled();
  });
});
