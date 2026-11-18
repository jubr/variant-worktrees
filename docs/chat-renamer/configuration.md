# Configuration

Editor settings you set explicitly win over `variants.yaml`, which wins over the defaults. A list you set replaces the defaults. The chat renamer reads the `chatRenamer` section of the [`variants.yaml`](/guide/configuration) of the project; how its options behave is described in the [overview](./).

## Options

Every key of `chatRenamer` has a heading of its own below, in alphabetical order, and so has every sub-key, right after its parent.

```yaml
chatRenamer:
  trigger: titleEvent # hook
  hookScope: workspace # user; where the hook is installed when trigger is hook
  activationPatterns: # replaces the defaults; the first capture group is the title
    - '/[a-z]+-spec-[a-z]+\s+([A-Za-z0-9_-]+)'
  worktreePrefixes: # replaces variant.prefix; [] turns path derivation off
    - _v-
  renameExistingDays: 7 # 0 turns off renaming of chats that existed before the editor started
  titleEventPromptLines: 10 # lines of a new chat's first prompt the title event tests (at least 1)
  awake:
    when: chatsActive # never; hold the Mac awake while a chat is in a turn
    cmd: "/usr/bin/caffeinate -disu -w ${extensionHostPid}" # any command, split on spaces, no shell; ${extensionHostPid} is this host's pid
    graceDelaySecs: 180 # seconds to stay awake after the last turn; 0 stops at once
```

### `chatRenamer.activationPatterns`

Regular expressions tested against each line of the first prompt; the first capture group becomes the title, or the whole match when there is no group. The list you set replaces the defaults, and an empty list turns patterns off. See [Activation patterns](./#activation-patterns).

The defaults are a path pattern, then a short `_work-` pattern, then a slug pattern:

```yaml
chatRenamer:
  activationPatterns:
    - '/[a-z]+-spec-[a-z]+\s+@\S+/[A-Za-z0-9_]+-([A-Za-z0-9_-]+)/?(?=\s|$)'
    - '/[a-z]+-spec-[a-z]+\s+@_work-([A-Za-z0-9_-]+)/?(?=\s|$)'
    - '/[a-z]+-spec-[a-z]+\s+([A-Za-z0-9_-]+)'
```

### `chatRenamer.awake`

Holds the Mac awake while a chat in this window is taking a turn. The options are [`chatRenamer.awake.when`](#chatrenamer-awake-when), [`chatRenamer.awake.cmd`](#chatrenamer-awake-cmd) and [`chatRenamer.awake.graceDelaySecs`](#chatrenamer-awake-gracedelaysecs). How it behaves is in [Awake](./#awake).

### `chatRenamer.awake.cmd`

The command that holds the machine awake, by default `/usr/bin/caffeinate -disu -w ${extensionHostPid}`. It is split on spaces and run without a shell, so it must stay in the foreground. `${extensionHostPid}` is replaced with this extension host's pid. A command that waits on that pid, like the default, exits when that host exits; any other command can outlive a host that is killed. Any `awake.cmd` is tried, once at startup for up to 1 second with no chat running, so a command that cannot be executed logs one `[awake]` warning right after the startup line and is not warned about again.

### `chatRenamer.awake.graceDelaySecs`

Seconds to keep the machine awake after this host's last turn (default `180`). `0` stops it immediately.

### `chatRenamer.awake.when`

`chatsActive` (default) runs one `caffeinate` process while a chat in this window is taking a turn or generating, including tool work of that turn. Awake follows this window's turn events and also polls the first 20 last-focused composers every 5 seconds. A chat in another workspace does not count. An open, selected, or idle chat does not count. `never` does not start it. The startup line names `agentHost+poll` or `poll`.

### `chatRenamer.hookScope`

`workspace` (default) or `user`: where the hook is installed when [`chatRenamer.trigger`](#chatrenamer-trigger) is `hook`, the first workspace folder or the user home.

### `chatRenamer.renameExistingDays`

Also renames chats created within this many days before the editor started (default `7`). `0` turns it off. See [Existing chats](./#existing-chats).

### `chatRenamer.titleEventPromptLines`

How many lines of a new chat's first prompt the title event tests for a rename request (default `10`, at least `1`). The other triggers and the palette commands read the whole prompt.

### `chatRenamer.trigger`

What renames a chat: `titleEvent` (default), Cursor's title event, or `hook`, a `beforeSubmitPrompt` hook. See [Triggers](./#triggers).

### `chatRenamer.worktreePrefixes`

Worktree directory prefixes including their connector, such as `_v-`, that name a chat when a worktree folder is dragged in. They replace [`variant.prefix`](/guide/configuration#variant-prefix); an empty list turns that path derivation off.

## Editor settings

These are settings of the editor, not keys of `variants.yaml`.

`variant.enable` defaults to true. Set it to false to turn chat renaming off in this extension. It does not turn awake off.

`variant.log.highVolumeCategories` is an opt-in checkbox list whose first entry is `awake.agentHostEvents`. The standalone extension uses `chat-renamer.log.highVolumeCategories` for the same list.
