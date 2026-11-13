# Configuration

Editor settings you set explicitly win over `variants.yaml`, which wins over the defaults.

A list you set replaces the defaults.

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
    cmd: "caffeinate -disu -w ${extensionHostPid}" # the only command; ${extensionHostPid} is this host's pid
    graceDelaySecs: 180 # seconds to stay awake after the last turn; 0 stops at once
```

`variant.enable` defaults to true. Set it to false to turn chat renaming off in this extension. It does not turn `awake` off.

`awake.when` `chatsActive` (default) runs one `caffeinate` process while a chat in this window is taking a turn or generating, including tool work of that turn. Awake follows this window's turn events and also polls the first 20 last-focused composers every 5 seconds. A chat in another workspace does not count. An open, selected, or idle chat does not count. `never` does not start it. The only command is `caffeinate -disu -w ${extensionHostPid}`, which is the default of `awake.cmd`. `${extensionHostPid}` is replaced with this extension host's pid, so the child exits when that host exits. Any other `awake.cmd` does not start a process. `awake.graceDelaySecs` (default `180`) is how long that process stays after this host's last turn. `0` stops it immediately. The startup line names `agentHost+poll` or `poll`. `variant.log.highVolumeCategories` is an opt-in checkbox list whose first entry is `awake.agentHostEvents`. The standalone extension uses `chat-renamer.log.highVolumeCategories` for the same list. It is an editor setting, not a `variants.yaml` key.

How those options behave is in [Overview](./).
