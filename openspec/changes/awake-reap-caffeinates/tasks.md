## 1. Wait on the host pid

- [ ] 1.1 Extend `packages/chat-renamer-api/src/awake.spec.ts` with failing assertions for [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active) and [specs/chat-renamer/awake | Awake activity is logged](../../specs/chat-renamer/awake/spec.md#requirement-awake-activity-is-logged). Inject spawn, the host pid `5151`, and the clock. No real `caffeinate`. Cover: `screen` spawns argv `["-disu", "-w", "5151"]` and `cpu` spawns `["-dis", "-w", "5151"]`; a second active session of this host does not spawn again; the same argv does not replace the child; a `what` change kills and then spawns the new argv only after the first child exits; idle, `never`, `owned: false`, and dispose still kill at once. The debug start line is `[awake] + "caffeinate -disu -w 5151" pid=4242 reason="activity"` and is not trace. Kill lines stay `[awake] + "kill <pid>"` with the existing reasons and do not quote `caffeinate`. Verify with `mise x -- bun test packages/chat-renamer-api/src/awake.spec.ts`: the new assertions fail.

- [ ] 1.2 Teach the controller to spawn that argv from an injected host pid and to compare the full argv. Keep `SIGTERM` then `SIGKILL` for idle, `never`, dispose, and loss of ownership. Quote the full argv on the debug start line. Verify with the same `bun test` command: the file passes.

## 2. This host's sessions only

- [ ] 2.1 Add `packages/chat-renamer-vscode/src/cursor/composer-activity.spec.ts` with failing assertions for [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active). Use a temporary sqlite database and the real reader. A generating composer that appears only in the newest headers, and is not in the open-id list, is idle. A generating composer whose id is in the open-id list is active. With no `composerHeaders` table, a generating `composerData` row that is not an open id is idle, and a generating open id is active. A missing database is idle. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/cursor/composer-activity.spec.ts`: the new assertions fail.

- [ ] 2.2 Change `readComposerActivity` so it point-reads only the open ids it is given. Do not prepend global header ids. Do not fall back to a `composerData:%` scan. Leave the session-file walk on this host's workspace folders as it is. Verify with the same `bun test` command: the file passes.

## 3. Extension wiring

- [ ] 3.1 Extend `packages/chat-renamer-vscode/src/trigger.spec.ts` with failing assertions, citing [specs/chat-renamer/awake | One caffeinate process while a chat session is active](../../specs/chat-renamer/awake/spec.md#requirement-one-caffeinate-process-while-a-chat-session-is-active). The owning instance, with an injected host pid `5151` and activity true, calls spawn with `["-disu", "-w", "5151"]`. An idle copy does not spawn. Dispose still stops the child. The fake spawn must not exec `caffeinate`. Verify with `mise x -- bun test packages/chat-renamer-vscode/src/trigger.spec.ts`: the new assertions fail.

- [ ] 3.2 Pass the argv list through `spawnCaffeinate` to `node:child_process` `spawn` with `stdio: "ignore"` and without `detached`. Default the host pid to `process.pid` when the trigger host does not inject one. Verify with the same `bun test` command: the file passes.

## 4. Docs

- [ ] 4.1 Update `docs/chat-renamer/index.md`, `docs/chat-renamer/configuration.md`, `packages/chat-renamer-vscode/README.md`, `packages/variant-config/variants.example.yaml`, and an Added bullet under `## Unreleased` in `CHANGELOG.md`, `packages/chat-renamer-vscode/CHANGELOG.md`, and `packages/variant-vscode/CHANGELOG.md`. State that each host runs one `caffeinate` only for its own sessions, that another workspace does not count, and that `screen` runs `caffeinate -disu -w <host-pid>` and `cpu` runs `caffeinate -dis -w <host-pid>`, so the child exits when that host exits. Verify each of those files says that, and that each changelog still has `## Unreleased` above its newest version heading.

## 5. Validation

- [ ] 5.1 Run `mise x -- openspec validate --all --strict --no-interactive` and `mise x -- bun test packages/chat-renamer-api/src/awake.spec.ts packages/chat-renamer-vscode/src/cursor/composer-activity.spec.ts packages/chat-renamer-vscode/src/trigger.spec.ts`. Verify both exit 0.
