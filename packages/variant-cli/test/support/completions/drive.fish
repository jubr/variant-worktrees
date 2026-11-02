# Drives the generated fish completion script. Needs SCRIPT, ROOT and STUB_LOG. Prints `key=value` lines.
source $SCRIPT

function complete_line
    echo "$argv[2]="(string join ' ' (complete -C "$argv[1]" | string split -f1 \t))
end
function calls
    wc -l <$STUB_LOG | string trim
end

cd $ROOT/a
complete_line "variant " commands
sleep 0.5
echo "calls_after_prefetch="(calls)
complete_line "variant up -s " slugs
echo "calls_after_slugs="(calls)
complete_line "variant up -s " slugs_again
echo "calls_after_again="(calls)
printf 'new-one\n' >>$ROOT/a/slugs
set -g __variant_time (math (date +%s) - 31)
complete_line "variant up -s " slugs_stale
echo "calls_after_stale="(calls)
cd $ROOT/b
complete_line "variant up -s " slugs_other_dir
echo "calls_after_other_dir="(calls)
