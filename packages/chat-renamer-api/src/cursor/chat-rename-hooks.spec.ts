import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  addChatRenameHook,
  installChatRenameHook,
  isChatRenameHook,
  removeChatRenameHook,
  renderHookScript,
  uninstallChatRenameHook,
} from "./chat-rename-hooks";

const HOOK_SCRIPT_NAME = "demo-chat-rename.sh";
const COMMAND = `.cursor/hooks/${HOOK_SCRIPT_NAME}`;

describe("hooks.json editing", () => {
  it("creates a version 1 file with a beforeSubmitPrompt entry", () => {
    expect(addChatRenameHook(undefined, COMMAND, HOOK_SCRIPT_NAME)).toEqual({
      version: 1,
      hooks: { beforeSubmitPrompt: [{ command: COMMAND }] },
    });
  });

  it("keeps unrelated hooks and extra keys", () => {
    const existing = {
      version: 1,
      note: "keep",
      hooks: {
        sessionStart: [{ command: "echo hi" }],
        beforeSubmitPrompt: [{ command: "./other.sh", matcher: "x" }],
      },
    };

    const next = addChatRenameHook(existing, COMMAND, HOOK_SCRIPT_NAME);

    expect(next.note).toBe("keep");
    expect(next.hooks?.sessionStart).toEqual([{ command: "echo hi" }]);
    expect(next.hooks?.beforeSubmitPrompt).toEqual([{ command: "./other.sh", matcher: "x" }, { command: COMMAND }]);
    expect(existing.hooks.beforeSubmitPrompt).toHaveLength(1);
  });

  it("is idempotent", () => {
    const once = addChatRenameHook(undefined, COMMAND, HOOK_SCRIPT_NAME);

    expect(addChatRenameHook(once, COMMAND, HOOK_SCRIPT_NAME)).toEqual(once);
  });

  it("removes only our entry and drops emptied events", () => {
    const withOurs = addChatRenameHook(
      {
        version: 1,
        hooks: { sessionStart: [{ command: "echo hi" }], beforeSubmitPrompt: [{ command: "./other.sh" }] },
      },
      COMMAND,
      HOOK_SCRIPT_NAME,
    );

    expect(removeChatRenameHook(withOurs, HOOK_SCRIPT_NAME).hooks?.beforeSubmitPrompt).toEqual([
      { command: "./other.sh" },
    ]);
    expect(
      removeChatRenameHook(addChatRenameHook(undefined, COMMAND, HOOK_SCRIPT_NAME), HOOK_SCRIPT_NAME).hooks,
    ).toEqual({});
  });

  it("recognises its own entry by script name", () => {
    expect(isChatRenameHook({ command: `/home/me/.cursor/hooks/${HOOK_SCRIPT_NAME}` }, HOOK_SCRIPT_NAME)).toBe(true);
    expect(isChatRenameHook({ command: "./other.sh" }, HOOK_SCRIPT_NAME)).toBe(false);
    expect(isChatRenameHook({}, HOOK_SCRIPT_NAME)).toBe(false);
  });

  it("leaves the hook of another renamer extension alone", () => {
    const other = { command: ".cursor/hooks/other-chat-rename.sh" };
    const file = addChatRenameHook({ version: 1, hooks: { beforeSubmitPrompt: [other] } }, COMMAND, HOOK_SCRIPT_NAME);

    expect(file.hooks?.beforeSubmitPrompt).toEqual([other, { command: COMMAND }]);
    expect(removeChatRenameHook(file, HOOK_SCRIPT_NAME).hooks?.beforeSubmitPrompt).toEqual([other]);
  });
});

describe("renderHookScript", () => {
  it("opens the extension URI and blocks only /chat-rename prompts", () => {
    const script = renderHookScript("cursor://variant.variant-vscode/chat-rename", ["^x$"], HOOK_SCRIPT_NAME);

    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script).toContain("cursor://variant.variant-vscode/chat-rename");
    expect(script).toContain("conversation_id");
    expect(script).toContain("chat-rename|rename-chat");
    expect(script).toContain(Buffer.from('["^x$"]').toString("base64"));
    expect(script).toContain('"continue": False');
    expect(script).toContain('"continue": True');
    expect(script).toContain(HOOK_SCRIPT_NAME);
  });
});

describe("install and uninstall", () => {
  const freshDir = () => mkdtempSync(join(tmpdir(), "vw-hooks-"));

  it("writes the script and hooks.json", async () => {
    const cursorDir = freshDir();

    await installChatRenameHook({
      cursorDir,
      command: COMMAND,
      script: "#!/bin/sh\necho ok\n",
      scriptName: HOOK_SCRIPT_NAME,
    });

    const script = join(cursorDir, "hooks", HOOK_SCRIPT_NAME);
    expect(readFileSync(script, "utf8")).toBe("#!/bin/sh\necho ok\n");
    expect(statSync(script).mode & 0o111).not.toBe(0);
    expect(JSON.parse(readFileSync(join(cursorDir, "hooks.json"), "utf8"))).toEqual({
      version: 1,
      hooks: { beforeSubmitPrompt: [{ command: COMMAND }] },
    });
  });

  it("merges into an existing hooks.json", async () => {
    const cursorDir = freshDir();
    writeFileSync(
      join(cursorDir, "hooks.json"),
      JSON.stringify({ version: 1, hooks: { sessionStart: [{ command: "echo hi" }] } }),
    );

    await installChatRenameHook({ cursorDir, command: COMMAND, script: "x", scriptName: HOOK_SCRIPT_NAME });

    const parsed = JSON.parse(readFileSync(join(cursorDir, "hooks.json"), "utf8"));
    expect(parsed.hooks.sessionStart).toEqual([{ command: "echo hi" }]);
    expect(parsed.hooks.beforeSubmitPrompt).toEqual([{ command: COMMAND }]);
  });

  it("refuses to overwrite an unreadable hooks.json", async () => {
    const cursorDir = freshDir();
    writeFileSync(join(cursorDir, "hooks.json"), "{ not json");

    await expect(
      installChatRenameHook({ cursorDir, command: COMMAND, script: "x", scriptName: HOOK_SCRIPT_NAME }),
    ).rejects.toThrow("hooks.json");
    expect(readFileSync(join(cursorDir, "hooks.json"), "utf8")).toBe("{ not json");
  });

  it("uninstall leaves a hooks.json without our entry byte-for-byte alone", async () => {
    const cursorDir = freshDir();
    const original = '{"version":1,"hooks":{"sessionStart":[{"command":"echo hi"}]}}';
    writeFileSync(join(cursorDir, "hooks.json"), original);

    await uninstallChatRenameHook(cursorDir, HOOK_SCRIPT_NAME);

    expect(readFileSync(join(cursorDir, "hooks.json"), "utf8")).toBe(original);
  });

  it("uninstall removes our entry and script, and tolerates a missing install", async () => {
    const cursorDir = freshDir();
    await installChatRenameHook({ cursorDir, command: COMMAND, script: "x", scriptName: HOOK_SCRIPT_NAME });

    await uninstallChatRenameHook(cursorDir, HOOK_SCRIPT_NAME);

    expect(JSON.parse(readFileSync(join(cursorDir, "hooks.json"), "utf8")).hooks).toEqual({});
    expect(() => statSync(join(cursorDir, "hooks", HOOK_SCRIPT_NAME))).toThrow();
    mkdirSync(join(cursorDir, "empty"), { recursive: true });
    await uninstallChatRenameHook(join(cursorDir, "empty"), HOOK_SCRIPT_NAME);
  });
});
