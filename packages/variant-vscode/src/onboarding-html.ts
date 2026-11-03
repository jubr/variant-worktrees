/**
 * Specification: openspec/changes/variant-init-onboarding/specs/variant-vscode/onboarding/spec.md
 * (Onboarding command and dialog)
 */

export const DEFAULT_PREFIX = "_v-";

/** What the page sends to the extension. */
export type DialogMessage =
  | { type: "cancel" }
  | { type: "trust" }
  | { type: "init"; prefix: string; file: boolean; gitignore: boolean; mise: boolean };

/** What the extension sends to the page. */
export type HostMessage =
  /** An `Init` that did not complete: its message, whether a `variants.yaml` exists now, and a directory to trust. */
  { type: "failed"; message: string; hasConfig: boolean; trust?: string } | { type: "config"; hasConfig: boolean };

export interface OnboardingHtmlOptions {
  nonce: string;
  cspSource: string;
  /** The extension icon as the webview loads it. */
  iconUri: string;
  /** A `variants.yaml` exists: the first checkbox starts unchecked and disabled. */
  hasConfig: boolean;
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The reason a prefix cannot be used, or nothing when it can. The page and `variant init` apply the same rule. */
export const prefixProblem = (prefix: string): string | undefined => {
  if (prefix === "") {
    return "The prefix must not be empty.";
  }
  return /[\\/]/.test(prefix) ? "The prefix must not contain a path separator." : undefined;
};

const STYLE = `
  body { margin: 0; padding: 8px 12px 16px; color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
  main { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: 1.15em; font-weight: 600; overflow-wrap: anywhere; }
  .icon { width: 20px; height: 20px; flex: none; }
  p { margin: 0; line-height: 1.4; overflow-wrap: anywhere; }
  label { display: flex; align-items: flex-start; gap: 6px; line-height: 1.4; overflow-wrap: anywhere; }
  label.field { flex-direction: column; gap: 4px; }
  input[type=text] { box-sizing: border-box; width: 100%; padding: 4px 6px; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); }
  input[type=text]:focus { outline: 1px solid var(--vscode-focusBorder); }
  input[type=checkbox] { flex: none; margin: 2px 0 0; }
  .note { color: var(--vscode-descriptionForeground); }
  .problem, .error { color: var(--vscode-errorForeground); }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  button { padding: 4px 12px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 1px solid var(--vscode-button-border, transparent); cursor: pointer; }
  button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
  button:disabled { opacity: 0.5; cursor: default; }
  [hidden] { display: none !important; }
`;

const SCRIPT = `
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);
  const prefix = $("prefix"), file = $("file"), gitignore = $("gitignore"), mise = $("mise");
  const init = $("init"), cancel = $("cancel"), trust = $("trust");
  const problem = $("problem"), error = $("error"), pattern = $("pattern"), fileNote = $("file-note");
  let trustDirectory;
  let busy = false;

  const problemOf = (value) => {
    if (value === "") return "The prefix must not be empty.";
    return /[\\\\/]/.test(value) ? "The prefix must not contain a path separator." : undefined;
  };
  const refresh = () => {
    const reason = problemOf(prefix.value);
    problem.textContent = reason ?? "";
    problem.hidden = reason === undefined;
    pattern.textContent = prefix.value + "*";
    init.disabled = busy || reason !== undefined;
    cancel.disabled = busy;
  };
  const setConfig = (hasConfig) => {
    file.disabled = hasConfig;
    if (hasConfig) file.checked = false;
    fileNote.hidden = !hasConfig;
  };
  const send = () => {
    error.hidden = true;
    trust.hidden = true;
    busy = true;
    refresh();
    vscode.postMessage({ type: "init", prefix: prefix.value, file: file.checked, gitignore: gitignore.checked, mise: mise.checked });
  };

  prefix.addEventListener("input", refresh);
  init.addEventListener("click", send);
  cancel.addEventListener("click", () => vscode.postMessage({ type: "cancel" }));
  trust.addEventListener("click", () => {
    if (trustDirectory !== undefined) {
      busy = true;
      refresh();
      vscode.postMessage({ type: "trust" });
    }
  });
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "config") {
      setConfig(message.hasConfig);
    }
    if (message.type === "failed") {
      busy = false;
      setConfig(message.hasConfig);
      error.textContent = message.message;
      error.hidden = false;
      trustDirectory = message.trust;
      trust.hidden = message.trust === undefined;
      refresh();
    }
  });
  refresh();
`;

/**
 * The page of the dialog. It loads nothing from outside the extension's own files: scripts run only with `nonce`, and
 * the colors are the editor theme variables.
 */
export const buildOnboardingHtml = (options: OnboardingHtmlOptions): string => {
  const { nonce, cspSource, hasConfig } = options;
  const policy = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`,
    `img-src ${cspSource}`,
  ].join("; ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${policy}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Initialize Variant</title>
  <style nonce="${nonce}">${STYLE}</style>
</head>
<body>
  <main>
    <header>
      <h2>Initialize Variant</h2>
      <img class="icon" src="${escapeHtml(options.iconUri)}" alt="" />
    </header>
    <p>Variant gives every git worktree its own database and ports. This sets up this workspace from what it detects.</p>
    <label class="field">Prefix
      <input id="prefix" type="text" value="${DEFAULT_PREFIX}" spellcheck="false" autocomplete="off" />
    </label>
    <p id="problem" class="problem" role="alert" hidden></p>
    <label><input id="file" type="checkbox"${hasConfig ? " disabled" : " checked"} /><span>Write variants.yaml with autodetected values</span></label>
    <p id="file-note" class="note"${hasConfig ? "" : " hidden"}>This workspace already has a variants.yaml, which is left as it is.</p>
    <label><input id="gitignore" type="checkbox" checked /><span>Add <span id="pattern">${DEFAULT_PREFIX}*</span> to .gitignore</span></label>
    <label><input id="mise" type="checkbox" checked /><span>Augment mise.toml with variant-cli</span></label>
    <p id="error" class="error" role="alert" hidden></p>
    <div class="buttons">
      <button id="trust" hidden>Trust</button>
      <button id="cancel" class="secondary">Cancel</button>
      <button id="init">Init</button>
    </div>
  </main>
  <script nonce="${nonce}">${SCRIPT}</script>
</body>
</html>
`;
};
