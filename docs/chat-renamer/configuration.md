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
    what: screen # cpu; screen is caffeinate -disu, cpu is caffeinate -dis
    graceDelaySecs: 60 # seconds to stay awake after the last turn; 0 stops at once
```

`variant.enable` defaults to true. Set it to false to turn chat renaming off in this extension. It does not turn `awake` off.

`awake.when` `chatsActive` (default) runs one `caffeinate` process while a chat is taking a turn or generating, including tool work of that turn. An open, selected, or idle chat does not count. `never` does not start it. `awake.what` `screen` (default) passes `-disu`; `cpu` passes `-dis`. `awake.graceDelaySecs` (default `60`) is how long that process stays after the last turn. `0` stops it immediately.

How those options behave is in [Overview](./).
