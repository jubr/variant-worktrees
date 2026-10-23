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
```

`variant.enable` defaults to true. Set it to false to turn chat renaming off in this extension.

How those options behave is in [Overview](./).
