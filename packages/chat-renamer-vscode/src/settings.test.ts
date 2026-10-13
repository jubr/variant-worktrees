import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as vscode from "vscode";

import { readSettings } from "./settings";

type Inspect = { globalValue?: unknown; workspaceValue?: unknown; workspaceFolderValue?: unknown };

const configure = (inspected: Record<string, Inspect>, effective: Record<string, unknown> = {}) =>
  spyOn(vscode.workspace, "getConfiguration").mockImplementation((() => ({
    get: (key: string) => effective[key],
    inspect: (key: string) => inspected[key],
  })) as unknown as typeof vscode.workspace.getConfiguration);

describe("readSettings", () => {
  afterEach(() => {
    configure({});
  });

  it("falls back to the defaults when nothing is set", () => {
    configure({});

    expect(readSettings("section")).toEqual({
      trigger: "titleEvent",
      hookScope: "workspace",
      activationPatterns: [
        "/[a-z]+-spec-[a-z]+\\s+@\\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\\s|$)",
        "/[a-z]+-spec-[a-z]+\\s+([A-Za-z0-9_-]+)",
      ],
      worktreePrefixes: [],
      renameExistingDays: 7,
    });
  });

  it("takes the editor's default when the host supplies nothing and the user set nothing", () => {
    configure({}, { renameExistingDays: 14 });

    expect(readSettings("section").renameExistingDays).toBe(14);
  });

  it("uses the host-supplied value over the editor's default", () => {
    configure({}, { renameExistingDays: 7 });

    expect(readSettings("section", { renameExistingDays: 30 }).renameExistingDays).toBe(30);
  });

  it("lets a value the user set explicitly win over the host-supplied one", () => {
    configure({ renameExistingDays: { globalValue: 0 } }, { renameExistingDays: 0 });

    expect(readSettings("section", { renameExistingDays: 30 }).renameExistingDays).toBe(0);
  });

  it("prefers the folder value over the workspace value over the user value", () => {
    configure({ trigger: { globalValue: "titleEvent", workspaceValue: "hook" } });
    expect(readSettings("section", { trigger: "titleEvent" }).trigger).toBe("hook");

    configure({ trigger: { globalValue: "titleEvent", workspaceValue: "titleEvent", workspaceFolderValue: "hook" } });
    expect(readSettings("section").trigger).toBe("hook");
  });

  it("reads host-supplied lists", () => {
    configure({});

    const settings = readSettings("section", { worktreePrefixes: ["_work-"], activationPatterns: [] });

    expect(settings.worktreePrefixes).toEqual(["_work-"]);
    expect(settings.activationPatterns).toEqual([]);
  });

  it("asks the editor for the section it was given", () => {
    const spy = configure({});

    readSettings("variant-worktrees.chatRename");

    expect(spy.mock.calls.at(-1)?.[0]).toBe("variant-worktrees.chatRename");
  });
});
