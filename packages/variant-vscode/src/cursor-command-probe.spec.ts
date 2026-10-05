import { describe, expect, it } from "bun:test";

import { formatProbeReport, selectCursorTitleCommands } from "./cursor-command-probe.ts";

describe("selectCursorTitleCommands", () => {
  it("reports chat-family title commands in UTF-16 order", () => {
    expect(selectCursorTitleCommands(["composer.renameChat", "agent.setLabel"])).toEqual([
      "agent.setLabel",
      "composer.renameChat",
    ]);
  });

  it("keeps only chat-family title commands", () => {
    expect(
      selectCursorTitleCommands([
        "cursor.openChat",
        "Cursor.SetTitle",
        "workbench.action.rename",
        "aichat.setTitle",
        "variant-vscode.helloworld",
        "agent.updateLabel",
        "composer.renameChat",
      ]),
    ).toEqual(["Cursor.SetTitle", "agent.updateLabel", "aichat.setTitle", "composer.renameChat"]);
  });

  it("lists each matching command id once", () => {
    expect(selectCursorTitleCommands(["composer.renameChat", "composer.renameChat"])).toEqual(["composer.renameChat"]);
  });
});

describe("formatProbeReport", () => {
  it("formats no matches as the empty-result line", () => {
    expect(formatProbeReport(["cursor.openChat", "variant-vscode.helloworld"])).toEqual([
      "No rename-like commands found in this build.",
    ]);
  });
});
