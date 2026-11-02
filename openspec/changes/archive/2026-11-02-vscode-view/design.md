## Context

The extension today hosts a Unix socket and the chat renamer; it contributes no views, depends on `chat-renamer`, `variant-config` and `variant-ipc`, and is bundled by esbuild as Node 12 CommonJS. Lifecycle commands run in `variant-api` (library, `variant` CLI) and `variant-mcp`. `listVariants` already returns `mode`, `url` and per-instance `alive`; `command-status` adds `uptimeSeconds` and `log` (a detached watch writes `variants.watch.log`). See proposal.md for motivation and the prerequisite changes (`command-status`; a runtime-neutral `variant-api` and a `variant-cli` package).

A watch writes `runtime` of the variant's `variants.local.yaml` as a whole (`writeVariantRuntime`), so anything stored in `main`'s runtime besides what `watch`, `up` and `down` produce is overwritten by them today.

## Goals / Non-Goals

**Goals:**

- One React app, no host-specific code in it, running in a webview and in a browser.
- The editor and the web page see the same state and run the same actions through one code path (`variant-api`), with no new lifecycle surface on the socket.
- Safe by default on a developer machine: a page that can implode a worktree must not be reachable by other users, other websites or other hostnames.

**Non-Goals:**

- Hot-reload tooling for the React app, a component library, SSR.
- Moving state out of `variants.local.yaml`.

## Decisions

### Packages and layering

`variant-ui` holds the React app and the `Transport` interface; it has no Node or editor imports and builds with `bun build` to a static `dist/` (HTML, JS, CSS, codicon font). `variant-server` depends on `variant-api` and serves `variant-ui`'s output. `variant-vscode` depends on `variant-api` and `variant-ui`, never on `variant-server`. `variant ui` is registered in `variant-cli` (prerequisite change), which depends on both `variant-api` and `variant-server`, so there is no cycle: `variant-api` knows nothing above it.

Alternative: serve from `variant-api`. Rejected: it would drag HTTP and static assets into the library every consumer installs, and the CLI move is already required.

### Transport is the only seam

```
interface Transport {
  records(): Variant[];            // current snapshot
  subscribe(cb): Unsubscribe;      // records + connection state changes
  state(): "connected" | "connecting" | "disconnected";
  watch(slug); down(slug); implode(slug, confirm); showOutput(slug);   // Promise<void>, rejects with a message
}
```

Two adapters: `webviewTransport` (messages over `acquireVsCodeApi().postMessage`, the extension answers from its store) and `httpTransport` (`fetch` for actions, `EventSource` for snapshots, reconnect with backoff). Components take a `Transport` from a context and read through `useSyncExternalStore`. `showOutput` in the browser fetches the log tail and shows it in a dialog; in the panel the extension opens the file.

The contract tests run the same suite against both adapters (real HTTP server on a random port with a fake store; a webview mock), which is the outside-in test of this change; component tests (happy-dom, Testing Library) and the tree provider tests sit below it.

### State subscription lives in `variant-api`

`client.subscribe(listener)` builds on `listVariants`. It watches every discovered `variants.local.yaml` and the state directory with `fs.watch` (re-armed when worktrees appear or disappear), plus one 5 s timer that only re-checks pid liveness, reads, drops `uptimeSeconds` when comparing with the previous set, and delivers on difference after a 200 ms debounce. Watchers and the timer exist once per client and are released when the last subscriber leaves. The tree, the panel's transport host and the server's SSE all call it, which is the only way they learn state.

Alternative: each consumer polls `list`. Rejected: three pollers and none sees a change faster than its interval. Alternative: file watching only. Rejected: a killed process changes no file.

### In-process lifecycle in the extension; the socket stays closed

The extension's views call `variant-api` in the extension host. The socket handler keeps throwing for lifecycle names, so no process can use the editor as a proxy; the `ipc-endpoint` requirement is reworded accordingly. Play starts `watch` with `detach: true` (as MCP does), whose output goes to `runtime.log`; stop calls `down`. The extension host is Node, so `variant-api` must not use `Bun.*` or `bun:*` there; that is the prerequisite change (sqlite through `node:sqlite` under Node, `bun:sqlite` under Bun).

Alternative: spawn the CLI. Rejected by the owner in favour of one in-process code path that tests can call without a binary.

### Raising the host floor

`node:sqlite` is available without a flag from Node 22.13. VS Code 1.101 ships Electron 35 with Node 22.15; VS Code 1.143 ships Node 24 and Cursor 3.27 ships Node 24.19 (both checked with `process.versions` and `require("node:sqlite")`). So `engines.vscode` and `@types/vscode` move from `^1.86.0` to `^1.101.0`, the esbuild `target` from `node12` to `node22`, and the extension keeps working on every current Cursor and VS Code. VS Code before 1.101 will not install it. A remote extension host runs the remote server's Node, which can be older; the view shows a clear error there instead of failing silently, and the CLI and MCP are unaffected.

### The UI server is an instance of `main` with a reserved key

`variant ui` writes `runtime.instances["variant-ui"] = { port, pid, url }` into `main`'s runtime state. Because `watch`, `up` and `down` rewrite `runtime` as a whole, `writeVariantRuntime` merges that one reserved entry from the file into whatever it writes for `main`, and the server removes only its own entry on exit. The key `variant-ui` is rejected as a configured instance key so a project cannot collide with it. The port is `VARIANT_UI_PORT`, else `variant.ui.port`, else a free unreserved port. `variant.ui` is the namespace for the server's settings, and its environment override follows the same rule as every other setting (`variant.ui.port` is `VARIANT_UI_PORT`). Because instance keys also map to `VARIANT_<KEY>_PORT`, an instance with the key `ui` would share that variable; every key whose environment segment is `UI` is therefore rejected, like `variant-ui` itself. Liveness comes for free from the existing pid check, so `list`, the tree, the panel and `status` need no special cases beyond the `UI server` row.

Alternative: a separate state file. Rejected by the owner: the server should look like any other running part. Alternative: one `ui` instance per variant. Rejected: every copy would show all variants.

The hostname `ui.<abbr>.localhost` resolves to loopback in current browsers without configuration, so the printed URL needs no hosts-file entry; the `Host` check accepts exactly that name, `localhost` and `127.0.0.1` with the server's port.

### Token, cookie and the token file

The token is 128 bits from `crypto.randomBytes`, printed once in the URL, exchanged for an HttpOnly SameSite=Strict cookie on first visit so it leaves the address bar, and kept in an owner-only (0600) file in the main `.vscode` directory (same directory and mode rules as the socket) so a later `variant ui` or the editor can open the running server. A process that can read that file can already run the commands directly, so the file adds no new capability. The owner chose loopback plus token plus confirmation; the `Host` check is added because the URL already pins the name and it closes DNS rebinding for free. `Origin` is not checked; actions require `application/json`, which a cross-site form cannot send without a preflight the server never answers.

### `variant.abbr`

The abbreviation is derived in `variant-config` from the basename of the main checkout directory, found with the existing git common-root detection that `detectVariantRoot` uses, so it is the same from any worktree. Words split at non-alphanumerics and at lowercase-to-uppercase boundaries; the first character of each word is kept and lowercased. `OtherTitleCase` gives `otc`; an all-caps word like `API` stays one word. A hyphenated explicit value is allowed because it is a valid DNS label part. The default `open` template now reads `{{abbr}}`; this repository's `vw` is unchanged, other projects get their own abbreviation, which is why the proposal marks it breaking.

### React stack and look

React 19, built by `bun build` (JSX, CSS and font assets), no Vite and no UI library (the VS Code webview toolkit is deprecated). Icons are `@vscode/codicons` in the app; the native tree uses `ThemeIcon`s with the same names (`eye` for watching, `play-circle` for up, `circle-outline` for down; actions `play`, `debug-stop`, `trash`). Styling is plain CSS over `--vscode-*` variables with a light/dark fallback keyed on `prefers-color-scheme`. The webview HTML is generated with a nonce CSP and `asWebviewUri` paths; the server uses a strict same-origin CSP.

### Decisions made while implementing

- The browser transport reads the event stream with `fetch` streaming, not `EventSource`: `EventSource` is missing in Bun and happy-dom, so the one implementation would be untestable, and `fetch` also lets the client apply backoff and an idle timeout of its own.
- `Transport.origin` (`"editor"` or `"server"`) decides whether the `variant-ui` row has a stop control. The editor stops the server with `down("variant-ui")`, which the extension maps to a `SIGTERM` of the recorded pid; the page served by the server shows the row without a stop control, since it would cut its own connection.
- The webview transport and its host half (`createWebviewTransport`, `attachWebviewHost`) live together in `variant-ui/protocol`, so the two ends cannot drift, and the shared contract suite runs against both ends over an in-memory channel. The host subscribes when the page says `ready`, so a snapshot is never posted before the page listens.
- The extension loads `variant-api` lazily. Where its sqlite module is missing, the Variants view shows the load error as its only item instead of the extension failing to activate.
- The `variant ui` core is `runUi` in `variant-server` (flags as options); `variant-cli` registers the `ui` command with `--detach` and `--stop`. `variant-server` stays a private, bin-less workspace library, not a product of its own: the `variant-cli` build bundles it into `dist/cli.js`, copies the built app to `dist/ui/`, and the CLI serves that directory (resolved from its own file URL). The compiled single-file executables embed the same files (`with { type: "file" }` imports generated by `scripts/package-cli.ts`) and serve them from a name-to-path map, since embedded names are hashed. From a source checkout the CLI falls back to the `variant-ui` build. So `variant ui` needs nothing next to the `variant` it runs from.

### Sort, the watch name, and whether implode would succeed

The view title carries a Sort menu in the `navigation` group ahead of Open Variants Panel, so it sits to that button's left. The six choices write `variant.sort` (`name-asc` by default, also settable in the Settings editor). The same value is sent with the panel snapshot, so the panel and the tree match; the browser page, which has no editor setting, uses `name-asc`. `main` is not pinned: it sorts with the others. The UI server row stays above the list.

`createdMs` is the earlier birth time of the variant directory and of its `variants.local.yaml` (a missing path is skipped). `changedMs` is the later modification time of those two. A missing time sorts as older than every known time. Ties break by slug, ascending, in every order.

`implodeClean` is decided in `variant-api` without deleting anything, by the same gates `implode` uses when `force` is not set. The merge gate counts. So do the files `git worktree remove` would still see after `preRm`, `untracked` and `restore`: an untracked file inside a `preRm` directory, an untracked file matching `untracked`, and a tracked modification whose base name is in `restore` are treated as already gone. A tracked file that `preRm` would delete, and that `restore` would not put back, still counts as dirt. Ignored files do not. `main` is never clean. The trash icon uses that flag: the foreground colour when clean (dark on a light theme, light on a dark theme) and red when dirty, with a red that stays readable on white and on a near-black background. The tooltip also says which, so the colour is not the only signal.

The play control's icon stays the play icon. The command title, which the tree shows as the tooltip, is `variant watch`, and the extension log names the activity `watch`.

### Where the view sits

An extension contributes `views.explorer` entries; the host orders them relative to built-ins itself and the user can drag them. The view is visible and expanded by default; placing it above Timeline cannot be guaranteed from the manifest.

## Risks / Trade-offs

- [The view may land below Timeline] → Documented; users drag it once and the host remembers. No proposed-API workaround.
- [`main`'s runtime is rewritten by lifecycle commands and drops the `variant-ui` entry] → `writeVariantRuntime` keeps the reserved entry; a test starts `watch`/`down` on `main` while the server entry exists.
- [Older VS Code or an older remote host cannot load `node:sqlite`] → Engines floor 1.101; the extension reports the missing module instead of crashing; CLI and MCP unaffected.
- [The token file or URL leaks to another local user] → 0600 file in an owner-only directory, loopback only, `Host` check, token required on every request; implode needs explicit confirmation and never applies to `main`.
- [Another process holds the chosen port between selection and bind] → Retry once with a new port, then fail with the bind error and leave no entry.
- [`fs.watch` is unreliable on some file systems (network mounts)] → The 5 s timer also re-reads and compares, so state converges without events.
- [Two projects with the same abbreviation] → The hostnames equal but ports differ, so URLs stay distinct.
- [Default `open` host changes for other projects] → Marked breaking in the proposal, CHANGELOG and docs; setting `open` or `variant.abbr: vw` keeps the old host.

## Migration Plan

Ship after `command-status` and the infrastructure change. Existing configurations keep working; only autodetected Vite instances in projects not called `vw` change host. Roll back by removing the contributed views (the manifest) and `variant ui`; `variant.abbr` and `{{abbr}}` can stay.
