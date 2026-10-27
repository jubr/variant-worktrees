import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  activationPatternSources,
  type ChatRenamerNames,
  catalogTitleDecision,
  claimRenamer,
  compilePatterns,
  type FirstPrompt,
  handleChatRenameUri,
  hookCommand,
  installChatRenameHook,
  type Logger,
  listPeerTitles,
  type RenameOptions,
  readFirstPrompt,
  readFirstPromptWithRetry,
  renderHookScript,
  resolveCursorDir,
  subscribeCatalogTitleChanges,
  uninstallChatRenameHook,
} from "chat-renamer-api";
import * as vscode from "vscode";

import { resolveChatRenameDeps } from "./cursor-host";
import type { ExistingChatsRunner, ExistingChatsTrigger } from "./existing-chats";
import { type HostSettings, readSettings } from "./settings";

/**
 * Wires the configured rename trigger:
 *  - titleEvent (default): on cursor.onDidChangeAgentHostSessionCatalogTitle, read the chat's first prompt from Cursor's
 *    on-disk store and rename when it holds a rename request. Only chats whose first prompt was sent after startup are renamed.
 *  - hook: install a beforeSubmitPrompt hook that sends /chat-rename prompts to this extension's URI handler.
 * Only one extension per host runs a trigger. Variant Worktrees wins when it is installed: Chat Renamer
 * stays idle. Otherwise the first to start owns renaming (see claimRenamer). Any other one
 * registers no listener, hook or URI handler and removes the hook script it wrote earlier.
 * The owner's URI handler is always registered. Switching the setting uninstalls the hook we wrote.
 * Resolves when the first setup pass is done.
 */
/** Seams for the host environment. Production code leaves them unset. */
export type TriggerHost = {
  /** Home folder whose `.cursor` receives user-scope hooks. */
  homeDir?: string;
  /** Reads a chat's first prompt. Default: Cursor's on-disk store. */
  readFirstPrompt?: (sessionId: string) => Promise<FirstPrompt | undefined>;
  now?: () => number;
  /** Renames chats that existed before startup. Without it no existing-chats run is scheduled. */
  existing?: ExistingChatsRunner;
  /** Option values the host supplies, e.g. from `variants.yaml`. Editor settings the user set explicitly win. */
  fileConfig?: HostSettings;
  /** Delay before the startup run and after the last title event. Default 3000 ms. */
  existingChatsDelayMs?: number;
};

const DEFAULT_EXISTING_CHATS_DELAY_MS = 3000;

const isExtension = (id: string, name: string): boolean => id === name || id.endsWith(`.${name}`);

/** Standalone Chat Renamer yields when Variant Worktrees is installed in this editor. */
const variantWorktreesHost = (selfId: string): string | undefined => {
  const installed = vscode.extensions?.all ?? [];
  return installed.find((extension) => extension.id !== selfId && isExtension(extension.id, "variant-worktrees"))?.id;
};

export const startChatRenameTrigger = (
  context: vscode.ExtensionContext,
  log: Logger,
  options: RenameOptions,
  names: ChatRenamerNames,
  host: TriggerHost = {},
): Promise<void> => {
  const home = host.homeDir ?? homedir();
  const now = host.now ?? Date.now;
  // Cursor re-emits title events for existing chats when it loads them. Only chats created after this moment count.
  const startedAtMs = now();
  if (typeof vscode.env?.appName !== "string") {
    return Promise.resolve();
  }

  const extensionId = context.extension.id;
  const variantHost = isExtension(extensionId, "chat-renamer") ? variantWorktreesHost(extensionId) : undefined;
  const claim = variantHost ? { owned: false, owner: variantHost, release: () => {} } : claimRenamer(extensionId);
  context.subscriptions.push({ dispose: claim.release });
  if (variantHost) {
    log.info(`${variantHost} is installed; this instance stays idle`);
  } else if (!claim.owned) {
    log.info(`${claim.owner} already runs chat renaming; this instance stays idle`);
  }

  if (claim.owned) {
    context.subscriptions.push(
      vscode.window.registerUriHandler({
        handleUri: async (uri) => {
          if (!readSettings(names.configSection, host.fileConfig).enabled) {
            log.info(`chat renaming off: ${names.configSection}.enable=false`);
            return;
          }
          try {
            const handled = await handleChatRenameUri(resolveChatRenameDeps(context), uri, options);
            log.info(`uri ${uri.path}${uri.query ? `?${uri.query}` : ""} handled=${handled}`);
          } catch (error) {
            log.error("uri handler failed", error);
            void vscode.window.showErrorMessage(
              `Chat rename failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
      }),
    );
  }

  options.peerTitles = async (sessionId) => {
    const openIds = await vscode.commands.executeCommand<string[]>("composer.getOrderedSelectedComposerIds");
    return listPeerTitles(resolveChatRenameDeps(context), Array.isArray(openIds) ? openIds : [], sessionId);
  };

  let eventSubscription: { dispose(): void } | undefined;
  let queue: Promise<void> = Promise.resolve();

  // Existing chats: one run shortly after startup, and another each time the burst of title events Cursor emits while
  // it loads old chats has died down. All of it follows `renameExistingDays`; 0 schedules nothing.
  let existingTimer: ReturnType<typeof setTimeout> | undefined;
  let existingSubscription: { dispose(): void } | undefined;
  let firstApply = true;
  const stopExisting = (): void => {
    clearTimeout(existingTimer);
    existingTimer = undefined;
    existingSubscription?.dispose();
    existingSubscription = undefined;
  };
  const configureExisting = (days: number, trigger: ExistingChatsTrigger): void => {
    stopExisting();
    const existing = host.existing;
    if (!existing) {
      return;
    }
    if (days === 0) {
      log.child("existing-chats").info(`off: ${existing.settingName}=0, so no startup, title-event or automatic runs`);
      return;
    }
    const delay = host.existingChatsDelayMs ?? DEFAULT_EXISTING_CHATS_DELAY_MS;
    log
      .child("existing-chats")
      .info(
        `on: ${existing.settingName}=${days}; first run (${trigger}) in ${delay}ms, again after title events settle`,
      );
    const runAfterDelay = (reason: ExistingChatsTrigger): void => {
      clearTimeout(existingTimer);
      existingTimer = setTimeout(() => {
        existingTimer = undefined;
        void existing.run(reason);
      }, delay);
    };
    runAfterDelay(trigger);
    try {
      existingSubscription = subscribeCatalogTitleChanges(resolveChatRenameDeps(context), () =>
        runAfterDelay("title events settled"),
      );
    } catch (error) {
      log
        .child("existing-chats")
        .warn(`not listening for title events: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const apply = async (): Promise<void> => {
    eventSubscription?.dispose();
    eventSubscription = undefined;

    const settings = readSettings(names.configSection, host.fileConfig);
    const { trigger, hookScope, enabled } = settings;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const chosenDir = resolveCursorDir(hookScope, workspaceRoot, home);
    const otherDirs = [...new Set([resolveCursorDir("workspace", workspaceRoot, home), join(home, ".cursor")])].filter(
      (dir) => !(claim.owned && enabled && trigger === "hook") || dir !== chosenDir,
    );
    const uninstallFrom = async (dirs: string[]): Promise<void> => {
      for (const dir of dirs) {
        try {
          await uninstallChatRenameHook(dir, names.hookScriptName);
        } catch (error) {
          log.warn(`could not clean ${dir}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };

    if (!enabled) {
      await uninstallFrom([...new Set([chosenDir, ...otherDirs])]);
      stopExisting();
      if (claim.owned) {
        log.info(`chat renaming off: ${names.configSection}.enable=false`);
      }
      return;
    }

    const activationPatterns = activationPatternSources(settings.worktreePrefixes, settings.activationPatterns);
    options.patterns = compilePatterns(activationPatterns, (source, error) =>
      log.warn(
        `ignoring invalid activation pattern ${JSON.stringify(source)}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    ).patterns;
    log.info(`activation patterns: ${JSON.stringify(activationPatterns)}`);

    await uninstallFrom(otherDirs);

    if (!claim.owned) {
      return;
    }

    const setUpTrigger = async (): Promise<void> => {
      if (trigger === "hook") {
        const uriBase = `${vscode.env.uriScheme}://${context.extension.id}/chat-rename`;
        await installChatRenameHook({
          cursorDir: chosenDir,
          command: hookCommand(chosenDir, workspaceRoot, names.hookScriptName),
          script: renderHookScript(uriBase, activationPatterns, names.hookScriptName),
          scriptName: names.hookScriptName,
        });
        log.info(`hook installed in ${chosenDir}`);
        return;
      }

      const dbPath = join(dirname(context.globalStorageUri.fsPath), "state.vscdb");
      const checked = new Set<string>();
      eventSubscription = subscribeCatalogTitleChanges(resolveChatRenameDeps(context), (change) => {
        // The first title event of a chat is the AI name for its first prompt. Later events are renames; skip them.
        if (checked.has(change.sessionId)) {
          return;
        }
        checked.add(change.sessionId);
        const readPrompt = (sessionId: string) =>
          readFirstPromptWithRetry(() =>
            (host.readFirstPrompt ?? ((id) => readFirstPrompt({ dbPath, sessionId: id })))(sessionId),
          );
        const decisionLog = log.child("title-event");
        void catalogTitleDecision(resolveChatRenameDeps(context), change, {
          ...options,
          readFirstPrompt: readPrompt,
          now,
          notBeforeMs: startedAtMs,
          maxLines: settings.titleEventPromptLines,
          decisionLog,
        }).catch((error: unknown) => {
          const detail = error instanceof Error ? error.message : String(error);
          decisionLog.error("decision", undefined, {
            session: change.sessionId,
            decision: "ignore",
            reason: "title event failed",
            detail,
          });
          void vscode.window.showWarningMessage(`Chat rename failed for ${change.sessionId}: ${detail}`);
        });
      });
      log.info("listening to onDidChangeAgentHostSessionCatalogTitle");
    };

    // The trigger is set up first so its listener comes before the existing-chats one.
    try {
      await setUpTrigger();
    } finally {
      configureExisting(settings.renameExistingDays, firstApply ? "startup" : "setting changed");
      firstApply = false;
    }
  };

  const schedule = (): Promise<void> => {
    queue = queue.then(apply).catch((error: unknown) => {
      log.error("trigger setup failed", error);
      void vscode.window.showWarningMessage(
        `Chat rename trigger setup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return queue;
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(names.configSection)) {
        schedule();
      }
    }),
    { dispose: () => eventSubscription?.dispose() },
    { dispose: stopExisting },
  );
  return schedule();
};
