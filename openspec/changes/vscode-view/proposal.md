## Why

Variants are started, watched and imploded from a terminal or by an agent over MCP. There is no place in the editor, and none in a browser, that shows which variants exist, whether each one is watching, up or down, and offers the three actions people reach for most: start a watch, bring it down, implode it. Editor users must remember CLI commands and read `variants.local.yaml` by hand to know what is running.

## What Changes

- Add a **Variants** view to the Explorer, collapsible and open by default, that lists every variant with a state icon (watching, up, down) and inline controls: play (start a watch), stop (bring it down) and implode (after a confirmation). Further actions: show the watch output, open the variant URL, open the panel, open the web page.
- Add a **panel** that renders the same list with React inside a webview, and the same React app is also served as a **web page** by a new local server (`variant ui`). One app, two transports: editor messaging in the webview, HTTP and server-sent events in the browser.
- Add `variant ui`: starts the local web server, records itself as a reserved `variant-ui` instance in the `main` variant's runtime state (own pid, port and URL `http://ui.<abbr>.localhost:<port>`), so it shows up in `variant list` and in the view. It binds to loopback only, requires a token, checks the `Host` header and confirms implode.
- Add `variant.abbr`: a short project label, autodetected from the main checkout's directory name from the first letter of each word (`variant-worktrees` is `vw`, `OtherTitleCase` is `otc`, `moreStuff` is `ms`, `lower_example` is `le`). It is used in hostnames and as the new `{{abbr}}` placeholder of `open` URL templates. **BREAKING**: the default `open` template of an autodetected Vite instance changes from the fixed `http://{{slug}}.vw.localhost:{{port}}` to `http://{{slug}}.{{abbr}}.localhost:{{port}}`, so projects whose directory does not abbreviate to `vw` get another default host.
- Add a state subscription to the library: the current variant records now, and again whenever runtime state, state files or process liveness change, so the tree, the panel and the web page stay current without each polling.
- Change the extension rule that it never executes lifecycle commands. The **socket** still refuses them; the extension's own views now run `watch`, `down` and `implode` in-process through `variant-api`. The extension needs a newer host (VS Code 1.101 or Cursor with the same Node 22 or later), because the sqlite adapter uses `node:sqlite` there.

Prerequisites, delivered by other changes and not specified here: `command-status` (the detached-watch log file `runtime.log` and `uptimeSeconds`), and an infrastructure change that makes `variant-api` run under Node as well as Bun (`node:sqlite`, a Node glob in place of `Bun.Glob`) and moves the `variant` CLI out of `variant-api` into a `variant-cli` package, which is where `variant ui` is registered.

## Capabilities

### New Capabilities

- `variant-api/state-watch`: the subscription that delivers variant records on change.
- `variant-ui/transport`: the contract between the React app and its host: snapshots, change notifications and the three actions.
- `variant-ui/variants-view`: what the React app shows and how its controls behave per state.
- `variant-server/http-api`: the loopback HTTP surface: token, host check, snapshot, events, actions, log tail and the static app.
- `variant-server/ui-instance`: `variant ui` and how the server records itself as the `variant-ui` instance of `main`.
- `variant-vscode/variants-tree`: the Explorer view, its icons, inline actions and host requirement.
- `variant-vscode/variants-panel`: the webview panel and the command that opens the web page.

### Modified Capabilities

- `variant-config/cfg-settings`: new `variant.abbr` setting and its autodetection.
- `variant-config/core`: the `open` URL template accepts `{{abbr}}`, and the default Vite template uses it.
- `variant-vscode/ipc-endpoint`: the socket keeps refusing lifecycle commands; in-process calls by the extension's own views are allowed.

## Impact

- New packages `variant-ui` (React 19, built with `bun build`, no Node dependencies) and `variant-server` (HTTP, SSE, static files, depends on `variant-api`).
- `packages/variant-vscode`: tree provider, panel, commands, `views` and `menus` contributions, bundled webview assets, `engines.vscode` and `@types/vscode` raised to `^1.101.0`, esbuild target raised to Node 22, a dependency on `variant-api`.
- `packages/variant-api`: the subscription; reserved-key handling so `watch`, `up` and `down` on `main` keep the `variant-ui` entry.
- `packages/variant-config`: `abbr` in the schema, JSON schema and example files; `{{abbr}}` in `open` templates; the `variant-ui` instance key is reserved.
- `variant-cli`: the `ui` command (introduced by the prerequisite change).
- `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, `docs/` and `CHANGELOG.md`: the new view, `variant ui`, `variant.abbr`; the "only editor requests go over the socket" rule is reworded.
- Specs: [specs/variant-vscode/variants-tree](../../specs/variant-vscode/variants-tree/spec.md), [specs/variant-server/http-api](../../specs/variant-server/http-api/spec.md), [specs/variant-ui/variants-view](../../specs/variant-ui/variants-view/spec.md).

## Non-goals

- A form-driven UI for `create`, `provision` or `config`; the view lists and controls existing variants only.
- Remote access: no binding beyond loopback, no TLS, no multi-user accounts.
- Starting the web server from the editor; the editor opens a running server and shows how to start one.
- Pinning the view above Timeline: the host decides the order of Explorer views.
- Streaming the live watch output into the UI; "show output" opens the log file.
- Playwright or other browser end-to-end tests.
