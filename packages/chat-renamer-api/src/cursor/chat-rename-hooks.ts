import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HOOK_EVENT = "beforeSubmitPrompt";

type HookEntry = { command?: string; matcher?: string; [key: string]: unknown };
export type HooksFile = {
  version?: number;
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
};

/** Whether `entry` runs the hook script called `scriptName`. Hooks of other tools and extensions never match. */
export const isChatRenameHook = (entry: HookEntry, scriptName: string): boolean =>
  typeof entry.command === "string" && entry.command.includes(scriptName);

/** Returns a copy of `file` with our beforeSubmitPrompt entry added once. Other hooks and keys are kept. */
export const addChatRenameHook = (file: HooksFile | undefined, command: string, scriptName: string): HooksFile => {
  const base = file ?? {};
  const others = (base.hooks?.[HOOK_EVENT] ?? []).filter((entry) => !isChatRenameHook(entry, scriptName));
  return {
    ...base,
    version: base.version ?? 1,
    hooks: { ...base.hooks, [HOOK_EVENT]: [...others, { command }] },
  };
};

/** Returns a copy of `file` without our entry. Events left empty are dropped. */
export const removeChatRenameHook = (file: HooksFile, scriptName: string): HooksFile => {
  const hooks: Record<string, HookEntry[]> = {};
  for (const [event, entries] of Object.entries(file.hooks ?? {})) {
    const kept = entries.filter((entry) => !isChatRenameHook(entry, scriptName));
    if (kept.length > 0) {
      hooks[event] = kept;
    }
  }
  return { ...file, hooks };
};

/**
 * beforeSubmitPrompt hook body. When a prompt line is a `/chat-rename` or `/rename-chat` command, or matches one of
 * the activation patterns, it opens the extension URI with the conversation id and prompt. A prompt that is only a
 * slash command is then blocked so no model turn is spent; every other prompt passes through unchanged.
 * Patterns are embedded at install time and evaluated with Python's `re`. Needs python3 and `open` (macOS) or
 * `xdg-open` (Linux).
 */
export const renderHookScript = (uriBase: string, patterns: readonly string[], scriptName: string): string => {
  const encoded = Buffer.from(JSON.stringify(patterns), "utf8").toString("base64");
  return `#!/bin/sh
# ${scriptName}: managed by a chat renamer VS Code extension. Switch its trigger setting away from hook to remove it.
HOOK_INPUT="$(cat)" python3 -c '
import base64, json, os, re, subprocess, sys, urllib.parse
try:
    data = json.loads(os.environ.get("HOOK_INPUT") or "{}")
except Exception:
    data = {}
prompt = str(data.get("prompt") or "")
lines = [line.strip() for line in prompt.splitlines() if line.strip()]
slash = re.compile(r"/(?:chat-rename|rename-chat)(\\s|$)")
patterns = []
for source in json.loads(base64.b64decode("${encoded}").decode("utf8")):
    try:
        patterns.append(re.compile(source))
    except re.error:
        pass
slash_only = len(lines) == 1 and slash.match(lines[0]) is not None
wanted = slash_only or any(slash.match(line) or any(p.search(line) for p in patterns) for line in lines)
if wanted:
    query = urllib.parse.urlencode({"id": data.get("conversation_id") or "", "prompt": prompt.strip()})
    opener = "open" if sys.platform == "darwin" else "xdg-open"
    subprocess.Popen([opener, "${uriBase}?" + query], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
if slash_only:
    print(json.dumps({"continue": False, "user_message": "Renaming chat."}))
else:
    print(json.dumps({"continue": True}))
'
`;
};

type InstallOptions = { cursorDir: string; command: string; script: string; scriptName: string };

const readHooksFile = async (path: string): Promise<HooksFile | undefined> => {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as HooksFile;
  } catch {
    throw new Error(`${path} is not valid JSON; fix hooks.json before enabling the chat rename hook`);
  }
};

const writeHooksFile = (path: string, file: HooksFile): Promise<void> =>
  writeFile(path, `${JSON.stringify(file, null, 2)}\n`, "utf8");

export const installChatRenameHook = async ({
  cursorDir,
  command,
  script,
  scriptName,
}: InstallOptions): Promise<void> => {
  const hooksPath = join(cursorDir, "hooks.json");
  const existing = await readHooksFile(hooksPath);
  const scriptDir = join(cursorDir, "hooks");
  const scriptPath = join(scriptDir, scriptName);
  await mkdir(scriptDir, { recursive: true });
  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);
  await writeHooksFile(hooksPath, addChatRenameHook(existing, command, scriptName));
};

export const uninstallChatRenameHook = async (cursorDir: string, scriptName: string): Promise<void> => {
  const hooksPath = join(cursorDir, "hooks.json");
  const existing = await readHooksFile(hooksPath);
  const hasOurEntry = Object.values(existing?.hooks ?? {}).some((entries) =>
    entries.some((entry) => isChatRenameHook(entry, scriptName)),
  );
  if (existing && hasOurEntry) {
    await writeHooksFile(hooksPath, removeChatRenameHook(existing, scriptName));
  }
  await rm(join(cursorDir, "hooks", scriptName), { force: true });
};
