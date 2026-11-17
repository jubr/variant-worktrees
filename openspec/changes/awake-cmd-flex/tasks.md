## 1. Custom command runs

- [ ] 1.1 Extend `packages/chat-renamer-api/src/awake.spec.ts` with failing assertions for [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active). Inject spawn, host pid `5151`, and the clock. Cover: `awake.cmd` `caffeinate -dis -w ${extensionHostPid}` spawns `["caffeinate", "-dis", "-w", "5151"]`; a non-caffeinate command spawns its own argv; a custom command still spawns when the `caffeinate` check failed at startup, and the default command still does not; changing `awake.cmd` while active kills the first child and, after its exit, spawns the new argv; idle, `never`, `owned: false`, and dispose still kill a custom command at once. Verify with `mise x -- bun test packages/chat-renamer-api/src/awake.spec.ts`: the new assertions fail.

- [ ] 1.2 Replace the one-argv gate in `packages/chat-renamer-api/src/awake.ts`: the default argv needs the startup `caffeinate` check, any other non-empty argv is tried, and the "other command" branch of `update` goes through `ensure`. Verify with the same `bun test` command: the file passes.

## 2. Failed start warns once

- [ ] 2.1 Extend `packages/chat-renamer-api/src/awake.spec.ts` with failing assertions for [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active) and [specs/chat-renamer/awake | Awake activity is logged](../../specs/chat-renamer/awake/spec.md#requirement-awake-activity-is-logged). Cover: a spawn that throws, a child that emits `error`, and a child that exits within 1 second each produce exactly one `[awake]` warn line naming the command and reason across several `update` calls; no process is tracked and no replacement is spawned at once; the next `update` with activity tries again without a second warn; a different failing command warns once for itself; a child that exits after more than 1 second is still replaced once with the existing `exit` warn; no start failure is logged at error. Verify with `mise x -- bun test packages/chat-renamer-api/src/awake.spec.ts`: the new assertions fail.

- [ ] 2.2 Add `once("error", …)` to `AwakeProcess`. In the controller, mark a child failed on `error` or on an unrequested exit within 1 second, keep a set of commands already warned about, and log the first failure of a command at warn and repeats at trace. Verify with the same `bun test` command: the file passes.

## 3. Startup probe

- [ ] 3.1 Extend `packages/chat-renamer-api/src/awake.spec.ts` with failing assertions for [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active) and [specs/chat-renamer/awake | Awake activity is logged](../../specs/chat-renamer/awake/spec.md#requirement-awake-activity-is-logged). Cover: the first `update` with `owned` and `chatsActive` and no activity spawns the command with debug reason `probe`; a probe that fails logs the warn line as the next `[awake]` line after the availability line; a probe with no activity is killed after 1 second with reason `probe` and an idle `update` does not arm the grace delay for it; activity inside the window keeps the same child and spawns no second; a second `update`, an `awake.cmd` change, and a `when` change after the probe do not probe again; `never`, `owned: false`, and the default command with `caffeinate` unavailable do not probe; a custom command with `caffeinate` unavailable does. Verify with `mise x -- bun test packages/chat-renamer-api/src/awake.spec.ts`: the new assertions fail.

- [ ] 3.2 Add the one-shot probe to the controller: start on the first qualifying `update`, flag the tracked child as a probe, kill it with reason `probe` after 1 second unless a session claimed it, and skip the grace delay for an unclaimed probe. Verify with the same `bun test` command: the file passes.

## 4. Extension wiring

- [ ] 4.1 Extend `packages/chat-renamer-vscode/src/awake-watch.spec.ts` (create it beside `awake-watch.ts` if absent) with failing assertions for the same requirement. `spawnCaffeinate(["/nonexistent/keep-awake"])` does not throw and its `once("error")` listener fires with the spawn error; an empty argv still throws. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/awake-watch.spec.ts`: the new assertions fail.

- [ ] 4.2 Forward the child's `error` event through `AwakeProcess.once("error", …)` in `spawnCaffeinate`, and keep an `error` listener attached so an unreachable program never becomes an unhandled event. Verify with the same `bun test` command: the file passes, and `mise x -- bun test packages/chat-renamer-vscode/src/trigger.spec.ts` still passes.

## 5. Docs

- [ ] 5.1 Update the `chat-renamer.awake.cmd` description in `packages/chat-renamer-vscode/package.json` and the `variant.awake.cmd` description in `packages/variant-vscode/package.json`, keeping both manifests identical in meaning. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/test/manifest.spec.ts packages/variant-vscode/src/test/chat-renamer-manifest.spec.ts`.

- [ ] 5.2 Update `docs/chat-renamer/index.md`, `docs/chat-renamer/configuration.md` (the prose and the `cmd:` comment in the YAML sample), `packages/chat-renamer-vscode/README.md`, and add a Changed bullet under `## Unreleased` in `CHANGELOG.md`, `packages/chat-renamer-vscode/CHANGELOG.md` (create the heading above the newest version), and `packages/variant-vscode/CHANGELOG.md`. State that any `awake.cmd` is tried, that `${extensionHostPid}` is replaced, that only a command waiting on that pid exits with a killed host, that the command must stay in the foreground, and that the command is tried once at startup for up to 1 second and a failure is logged right after the awake detection line, and that a command that fails to start logs one `[awake]` warning. Verify each file says that and each changelog keeps `## Unreleased` above its newest version heading. Remove every "Any other `awake.cmd` does not start a process" sentence.

## 6. Validation

- [ ] 6.1 Run `mise x -- openspec validate --all --strict --no-interactive`, `mise x -- task check:all`, and `mise x -- task build`. Verify all exit 0.
