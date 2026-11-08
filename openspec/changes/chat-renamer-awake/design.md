## Context

See proposal.md for why. Chat renamer options live in `chat-renamer-config` and are read in `chat-renamer-api` (`readTriggerSettings`). The extension applies them in `chat-renamer-vscode` (`readSettings`): an explicit editor value, then the host `fileConfig` from `variants.yaml`, then the default. Variant embeds the same registrar and contributes the same settings under `variant.*`. `startChatRenameTrigger` claims a single owner; an idle instance does not listen. `variant.enable` only gates renaming. `AgentHostApi` today exposes title projection, the session catalog, and title-change subscription, not a generating flag. `caffeinate` is a macOS system binary. The open change `better-logs` also edits `chat-renamer-config/defaults`; this change adds a requirement there instead of replacing `Shared renamer defaults and field schemas`.

## Goals / Non-Goals

**Goals:**

- One controller that starts, replaces, and kills a single `caffeinate` child from settings plus an active/idle signal.
- Settings and schema shared the same way as the existing renamer options.
- Tests that never spawn a real `caffeinate`.

**Non-Goals:**

- A second sleep inhibitor, a `hooks.json` entry, or a change to the claim registry.
- Gating awake on `enable`.

## Decisions

### Controller owns the pid, the host owns the signal

`chat-renamer-api` gains a controller. Callers push `{ when, what, active, owned }` and a dispose. It remembers one child: pid and the arguments it was spawned with. Desired arguments are `-disu` when `what` is `screen` and `-dis` when `what` is `cpu` (one argv element, the clustered flags). It spawns only when `owned` and `when` is `chatsActive` and `active` and no child with those arguments is alive. It kills when those stop being true, when arguments must change, and on dispose. A kill is `SIGTERM`, then `SIGKILL` if the child has not exited. The pid is forgotten only after exit, and the next spawn waits for that exit, so two children never overlap. An `exit` while the desired child is still wanted logs a warning and spawns a replacement. The child is not detached and not unref'd, so an extension-host crash does not leave `caffeinate` behind on its own; dispose still kills it.

Spawn and kill are injected. The vscode wiring uses `node:child_process` `spawn("caffeinate", [args], { stdio: "ignore" })`.

`ENOENT` latches "unavailable": one info log, no further spawns. Any other start failure is an error log with no pid stored, and the next update tries again. Neither failure throws to the host.

Alternative considered: shell out to `caffeinate -disu` as one string. That needs a shell and splits badly. Rejected. Alternative considered: `caffeinate -w <pid>` bound to the extension host. That does not match the two flag sets and does not stop when the chat goes idle. Rejected.

### Activity is a boolean the vscode layer publishes

The controller does not import Cursor. `chat-renamer-vscode` publishes `active` while any session is in a turn: generating, or tool work of that turn. An open or selected idle chat publishes `false`.

The publisher prefers a live function already present on `vscode.cursor` that reports generation or agent status. A missing function is skipped, not an error. Otherwise it polls the composer record through the same read-only `sqlite3` path the first-prompt reader uses, about once a second, and only while this instance is the owner and `awake.when` is `chatsActive`. A parser, fed fixture JSON, decides in-progress versus idle. The in-progress marker is whatever the current Cursor store writes; the fixture locks that marker. A session stays active for about two seconds after the last in-progress sample so a gap between tool calls does not kill the child. Dispose stops the poll.

Alternative considered: a `beforeSubmitPrompt` / `stop` hook. That writes `hooks.json` for a feature that must run in `titleEvent` mode too, and the proposal leaves hooks out. Rejected. Alternative considered: treating the selected chat as active. That holds the machine awake for a chat the user is only reading. Rejected.

### Settings follow the existing precedence

`chat-renamer-config` exports `chatsActive` / `never` and `screen` / `cpu`, defaults `chatsActive` and `screen`, from the main entry, and a strict optional `awake` object on `ChatRenamerConfigSchema`. `readTriggerSettings` reads `awake.when` and `awake.what` and falls back to those defaults. `readSettings` resolves each key as editor inspect, then `fileConfig.awake`, then `config.get`. Both manifests contribute the dotted keys with those enums and defaults. `registerChatRenamer` starts the controller on the owning instance even when `enabled` is false, and pushes a settings change into the controller without recreating the claim. The idle instance does not construct one.

`awake.what` defaults to `screen` because the request named a default only for `awake.when` and listed `screen` first. Display sleep is the failure this change is aimed at.

### Logs use the existing category logger

The controller logs through `logger.child("awake")`, so lines start with `[awake]`. Start and stop are info with fields `pid`, `args`, and `reason` (`activity`, `idle`, `never`, `disposed`, `not owner`, `mode changed`). An early exit is warn. A failed start is error. Unavailable is one info line.

## Risks / Trade-offs

- [Cursor's composer row has no stable in-progress marker] → The parser test uses a captured fixture. If a capture shows no marker and no live `vscode.cursor` status function, stop and report that; do not install a hook to paper over it.
- [`caffeinate -s` is ignored on battery] → The flag sets stay `-disu` and `-dis` as specified. On battery the display and idle assertions still apply; system sleep may not.
- [A two-second grace holds the machine awake after the turn] → Short, and idle chats never start the child. The grace is not a setting.
- [Polling sqlite once a second] → Only while owned and `chatsActive`. A live status event, when present, replaces the poll.
- [`better-logs` replaces the shared defaults requirement on archive] → This change adds a separate requirement, so neither archive deletes the other's text. Folding the awake fields into the shared requirement waits until both are archived.
- [Two embedded copies] → The existing claim still picks the owner. The idle copy never spawns.

## Migration Plan

No stored state and no `hooks.json` edit. Updating the extension starts the behavior on next activation; rollback removes the settings contribution, the controller, and the watcher. Old `variants.yaml` files stay valid because `awake` is optional. Removing the extension kills the child on dispose.

## Open Questions

None that change the specs or the task split. The in-progress composer marker is fixed by a fixture during implementation, not by a spec edit.
