## 1. Project abbreviation

- [x] 1.1 Add failing `variant-config` tests for `variant.abbr` (`variant-worktrees` is `vw`, `OtherTitleCase` is `otc`, `moreStuff` is `ms`, `lower_example` is `le`, single word, `___` is `app`, explicit value wins, invalid values fail, same result from a linked worktree); implement and verify `bun test` in `variant-config` passes
- [x] 1.2 Add `abbr` to the schema, `variants.yaml.schema.json` and `variants.example.yaml`; verify the example-in-sync test passes
- [x] 1.3 Add the `{{abbr}}` placeholder to `open` templates and make the default Vite template use it; verify tests for the explicit template, the default template and `http://add-auth.vw.localhost:62060`
- [x] 1.4 Reserve the `variant-ui` instance key; verify a test that a configured instance with that key fails validation naming it

## 2. State subscription

- [x] 2.1 Write failing library tests for `client.subscribe` (initial delivery, runtime file change, new state file, dead pid within 5 s, uptime-only change ignored, 100 ms burst gives one delivery); implement on `listVariants` with `fs.watch`, a 5 s liveness timer and a 200 ms debounce, and verify they pass
- [x] 2.2 Add failing tests for failure and teardown (read error keeps the last set and clears on recovery, unsubscribe stops deliveries, two subscribers share one watcher per path); implement and verify they pass
- [x] 2.3 Make `writeVariantRuntime` keep the reserved `variant-ui` entry when `watch`, `up` and `down` rewrite `main`; verify with a test that runs them while the entry exists

## 3. variant-ui (React app)

- [x] 3.1 Scaffold the `variant-ui` package (React 19, `bun build`, codicons, happy-dom and Testing Library for tests, workspace entry, Taskfile build target) and verify `task build` produces `dist/index.html`
- [x] 3.2 Write the `Transport` contract test suite and an in-memory transport; verify the suite fails, then implement the interface, context and `useSyncExternalStore` hook until it passes
- [x] 3.3 Write failing component tests for rows and states (watching, up, down, stale record, ordering, empty state, uptime format, icon plus label), then implement the list and verify they pass
- [x] 3.4 Write failing tests for controls per state, no implode on `main`, pending state, error on the row, implode confirmation accept and cancel, the `variant-ui` row with and without stop, show-output enablement and the disconnected state; implement and verify they pass
- [x] 3.5 Add the CSS with `--vscode-*` variables and a light and dark fallback; verify a test that the dark preference changes the palette and that no colour is the only state signal

## 4. variant-server

- [x] 4.1 Scaffold `variant-server` (bin-less library depending on `variant-api`, serving `variant-ui/dist`) and write failing HTTP tests for loopback binding, token required, cookie exchange with redirect, wrong token and `Host` checks (421); implement and verify they pass
- [x] 4.2 Add failing tests for `GET /api/variants`, the SSE stream (first event, change event, read error, keep-alive) and the log tail (lines, default, cap, 404); implement on `client.subscribe` and verify they pass
- [x] 4.3 Add failing tests for the action routes (watch, down, implode with and without `confirm`, `main` refused, unknown slug 404, failure 500, content type 415); implement and verify they pass
- [x] 4.4 Serve the static app with the same-origin content security policy and `index.html` for client routes; verify with tests for `/`, `/variants/demo` and the header
- [x] 4.5 Run the Transport contract suite against `httpTransport` and the real server on a random port and verify it passes

## 5. variant ui command

- [x] 5.1 Write failing tests for `variant ui` (printed URL shape with `<abbr>` and token, port override `VARIANT_UI_PORT`, reserved ports skipped, `--detach` returns); implement in `variant-cli` and verify they pass
- [x] 5.2 Add failing tests for recording the `variant-ui` instance in `main`'s runtime (listed by `variant list` and `status`, kept across `main`'s watch and down, removed on exit, owner-only token file); implement and verify they pass
- [x] 5.3 Add failing tests for one server per project (second run prints the URL and exits 0, stale entry replaced) and `--stop` (stops, cleans up, exits 0 with no server); implement and verify they pass

## 6. VS Code extension

- [x] 6.1 Raise `engines.vscode` and `@types/vscode` to `^1.101.0` and the esbuild target to Node 22, add the `variant-api` and `variant-ui` dependencies, and verify `task build` and the extension manifest test pass
- [x] 6.2 Reword the `ipc-endpoint` behavior in tests so lifecycle names still fail on the socket; verify the existing socket tests plus a test that the view actions never go through the socket pass
- [x] 6.3 Write failing tests against `mocks/vscode.ts` for the tree provider (items, three icons, tooltips, uptime description, `main` first, no-config and no-variants welcome content, `UI server` item), then implement it with the state subscription and verify they pass
- [x] 6.4 Add failing tests for the inline and context actions (play, stop, implode with modal accept and cancel, show output, open URL, error notification, progress item); implement the commands and the `views`, `viewsWelcome` and `menus` contributions and verify they pass
- [x] 6.5 Add failing tests for the panel (single instance and reveal, nonce CSP, message transport round-trip, same actions as the tree, subscription ends on close) and the open-in-browser command (running server, no server message with copy button); implement and verify they pass
- [x] 6.6 Bundle the `variant-ui` build into the vsix (`.vscodeignore`, `task package:vsix`) and verify the packaged file contains the webview assets

## 7. Documentation

- [x] 7.1 Reword `AGENTS.md` (the socket carries editor requests only; the extension's views call `variant-api` in-process) and `CONTRIBUTING.md` (new packages, test commands); verify the text matches the reworded spec
- [x] 7.2 Update `README.md`, the VS Code README and `docs/` for the Variants view, the panel, `variant ui` and the security model, `variant.abbr` and `{{abbr}}`, and the `variant-ui` reserved key; add `CHANGELOG.md` entries including **BREAKING** for the default `open` host and the VS Code 1.101 floor; verify `task docs:build` passes
- [x] 7.3 Run `task lint`, `task test`, `task build`, `task check:full` and `openspec validate --all --strict --no-interactive` and verify all pass

## 8. Amendments: UI port setting and CLI packaging

- [x] 8.1 Add failing `variant-config` tests for `variant.ui.port` (set, absent, invalid, unknown key) and for rejecting the instance keys `ui` and `UI`; add `ui.port` to the schema, `variants.yaml.schema.json` and `variants.example.yaml`, and verify they pass
- [x] 8.2 Add failing `variant-server` tests for the port order (`VARIANT_UI_PORT`, then `variant.ui.port`, then a free unreserved port; empty variable unset; invalid variable names itself); replace `VARIANT_VARIANT_UI_PORT` in code, tests and docs, and verify they pass
- [x] 8.3 Bundle the server and the app into the `variant-cli` package: failing test that the built `dist/cli.js` has no `variant-server` import and `dist/ui/index.html` exists, then change the build and resolve the app next to the CLI file; verify `variant ui --detach` serves the app from the built CLI
- [x] 8.4 Embed the app in the compiled executables (`scripts/package-cli.ts`) and serve it from a name-to-path map; verify with a test of the map serving and by running a compiled executable outside the repository
- [x] 8.5 Update `AGENTS.md`, `README.md`, `docs/`, `CHANGELOG.md` for `variant.ui.port`, `VARIANT_UI_PORT` and the packaging; run `task check:full` and `openspec validate --all --strict --no-interactive`

## 9. Sort, watch name, implode cleanliness

- [x] 9.1 Add failing tests that a record's `createdMs` is the earlier birth time of its directory and `variants.local.yaml`, and `changedMs` is the later modification time (directory only when the file is absent); implement on `list` and verify
- [x] 9.2 Add failing tests that `implodeClean` is false for `main` and for unmerged work, true for a clean merged worktree, true when the only dirt is a `preRm` untracked directory or a `restore` lockfile, and false for a modified source file; implement without deleting anything and verify
- [x] 9.3 Add failing tests for the six sort orders (missing times sort as older, ties by slug, UI server stays first) and for `variant.sort` default `name-asc`; contribute the Sort menu immediately left of Open Variants Panel and apply the setting to the tree and the panel
- [x] 9.4 Rename the play tooltip and the logged activity to `variant watch` / `watch`; keep the play icon; verify the view and the React row
- [x] 9.5 Show the trash icon on every row except `main`, rightmost, foreground when `implodeClean` is not false and red when it is false, readable on white and on a dark background; verify the tree contribution and the React row
- [x] 9.6 Update the README, the VS Code README, `docs/` and `CHANGELOG.md`; run `task check:full` and `openspec validate --all --strict --no-interactive`

