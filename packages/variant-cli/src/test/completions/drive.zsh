# Drives the generated zsh completion script in a real interactive zsh on a pty, pressing TAB. Needs SCRIPT, ROOT and
# STUB_LOG. Prints `key=value` lines. Usage: drive.zsh warm|cold|inflight
zmodload zsh/zpty
zpty z "zsh -f -i"

# Reads the pty until it has been quiet for a moment.
drain() {
  local out chunk quiet=0
  while ((quiet < 3)); do
    sleep 0.2
    if zpty -r -t z chunk; then
      out+=$chunk
      while zpty -r -t z chunk; do out+=$chunk; done
      quiet=0
    else
      ((quiet++))
    fi
  done
  print -rn -- "${out//$'\r'/}"
}
send() { zpty -w z "$1"; drain >/dev/null; }
calls() { print -r -- $(($(wc -l <$STUB_LOG))); }
report() { print -r -- "$1=$(calls)"; }
# The gathering runs in the background: waits for the stub to have started `$1` times, however busy the machine is,
# then reads what the shell printed meanwhile.
settle() {
  local i
  for ((i = 0; i < 400; i++)); do
    (($(calls) >= $1)) && break
    sleep 0.05
  done
  drain >/dev/null
}
# Prints what the shell remembers once that list contains `$1` (or what it has after about 20 seconds).
remembered_with() {
  local i out
  for ((i = 0; i < 100; i++)); do
    zpty -w z 'print -r -- "REMEMBERED:${(j: :)${(f)__variant_slugs}}"'
    out=$(drain)
    [[ $out == *"REMEMBERED:"*"$1"* ]] && break
    sleep 0.2
  done
  print -r -- "$out"
}
# Types `$1`, presses TAB, and prints what the shell showed, one line.
tab() {
  zpty -w -n z "$1"$'\t'
  local shown more tries=0
  shown=$(drain)
  # A busy machine reports quiet before zsh draws the list. The typed line has no newline; the list does.
  while ((tries < 5)) && [[ $shown != *$'\n'* ]]; do
    more=$(drain)
    shown+="$more"
    ((tries++))
  done
  print -r -- "$2=${shown//$'\n'/ | }"
  zpty -w -n z $'\x15'
  drain >/dev/null
}

send "PS1='READY> '; unsetopt zle_bracketed_paste; autoload -Uz compinit; compinit -u -d $ROOT/zdump"
send "zstyle ':completion:*' list-prompt ''; zstyle ':completion:*' menu no; setopt no_list_ambiguous"
send "eval \"\$(cat $SCRIPT)\""
send "cd $ROOT/a"
: >$STUB_LOG

case $1 in
warm)
  tab "variant " commands
  settle 1
  report calls_after_prefetch
  # The list lands in the shell without another keypress: print it, without completing.
  print -r -- "remembered=$(remembered_with add-auth | tr '\n' ' ')"
  tab "variant up -s " slugs
  report calls_after_slugs
  tab "variant up -s " slugs_again
  report calls_after_again
  print 'new-one' >>$ROOT/a/slugs
  send '__variant_time=$((__variant_time - 31))'
  tab "variant up -s " slugs_stale
  settle 2
  report calls_after_stale
  remembered_with new-one >/dev/null
  tab "variant up -s " slugs_after_stale
  report calls_after_refresh
  send "cd $ROOT/b"
  tab "variant up -s " slugs_other_dir
  settle 3
  report calls_after_other_dir
  ;;
cold)
  tab "variant up -s " slugs
  report calls
  ;;
inflight)
  tab "variant " commands
  tab "variant up -s " slugs
  report calls
  ;;
esac
zpty -d z
