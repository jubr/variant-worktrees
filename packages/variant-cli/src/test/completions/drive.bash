# Drives the generated bash completion script. Needs SCRIPT, ROOT, STUB_LOG and EXPECT_ASYNC (1 when this bash may
# prefetch). Prints `key=value` lines; the test asserts on them. Usage: drive.bash warm|cold|inflight
source "$SCRIPT"
# FORCE_SYNC=1 makes a modern bash take the path of bash older than 4.1.
[[ "$FORCE_SYNC" == 1 ]] && __variant_async=0

complete_line() {
  local line="$1"
  COMP_LINE="$line"
  read -ra COMP_WORDS <<<"$line"
  [[ "$line" == *" " ]] && COMP_WORDS+=("")
  COMP_CWORD=$((${#COMP_WORDS[@]} - 1))
  COMPREPLY=()
  _variant
  printf '%s=%s\n' "$2" "${COMPREPLY[*]-}"
}
calls() { wc -l <"$STUB_LOG" | tr -d ' '; }
# Waits for the stub to have started `$1` times, or briefly when no start is expected, then lets it finish.
settle() {
  local i
  if [[ "$EXPECT_ASYNC" == 1 ]]; then
    for i in $(seq 1 60); do
      [[ $(calls) -ge $1 ]] && break
      sleep 0.05
    done
  fi
  sleep 0.5
}
report() { printf '%s=%s\n' "$1" "$(calls)"; }

cd "$ROOT/a" || exit 1
case "$1" in
warm)
  complete_line "variant " commands
  settle 1
  report calls_after_prefetch
  complete_line "variant up -s " slugs
  report calls_after_slugs
  complete_line "variant up -s " slugs_again
  report calls_after_again
  printf 'new-one\n' >>"$ROOT/a/slugs"
  SECONDS=$((SECONDS + 31))
  complete_line "variant up -s " slugs_stale
  settle 2
  report calls_after_stale
  complete_line "variant up -s " slugs_after_stale
  report calls_after_refresh
  cd "$ROOT/b" || exit 1
  complete_line "variant up -s " slugs_other_dir
  settle 3
  report calls_after_other_dir
  echo "jobs=$(jobs)"
  ;;
cold)
  complete_line "variant up -s " slugs
  settle 1
  report calls
  echo "jobs=$(jobs)"
  ;;
inflight)
  complete_line "variant " commands
  complete_line "variant up -s " slugs
  settle 1
  report calls
  ;;
esac
