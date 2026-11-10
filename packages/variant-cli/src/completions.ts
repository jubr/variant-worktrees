// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the strings are shell script text, where ${...} is shell syntax
/**
 * Specification: openspec/specs/variant-cli/completions/spec.md
 *
 * Shell completion scripts for the `variant` CLI. Every script is rendered from one model of the CLI
 * (`describeCli()`), which is built from the same command definitions the CLI runs, so a command or flag added there is
 * completed without a separate edit. The scripts are plain strings: no file next to the binary is needed.
 */
import { commands } from "variant-api/commands";
import { flagSpecsFor, UI_DESCRIPTION, UI_FLAGS } from "./cli-flags.js";
import { LOG_LEVEL_FLAG } from "./ipc-log.js";
import { GLOBAL_FLAGS } from "./output.js";

export const SHELLS = ["zsh", "bash", "fish"] as const;
export type Shell = (typeof SHELLS)[number];

export interface FlagModel {
  long: string;
  short?: string;
  description: string;
  takesValue: boolean;
}

export interface CommandModel {
  name: string;
  description: string;
  /** The command accepts a variant slug, as `--slug`/`-s` and as its first positional argument. */
  takesSlug: boolean;
  flags: FlagModel[];
  /** Fixed values completed as the positional argument. */
  values?: string[];
}

/** The `completions` command itself, which is CLI-only and so is not one of `commands[]`. */
export const completionsCommand: CommandModel = {
  name: "completions",
  description: "Print a shell completion script (zsh, bash, fish)",
  takesSlug: false,
  flags: [
    {
      long: "list-slugs",
      description: "Print the slugs of existing variants, one per line",
      takesValue: false,
    },
  ],
  values: [...SHELLS],
};

/** The flags every cleye command line accepts. */
const HELP: FlagModel = { long: "help", short: "h", description: "Show help", takesValue: false };
const VERSION: FlagModel = { long: "version", description: "Show version", takesValue: false };

/** `variant ui`, which is CLI-only like `completions`. */
const uiCommandModel: CommandModel = {
  name: "ui",
  description: UI_DESCRIPTION,
  takesSlug: false,
  flags: Object.entries(UI_FLAGS).map(([long, flag]) => ({ long, description: flag.description, takesValue: false })),
};

/** The output flags every lifecycle command accepts. */
const outputFlags: FlagModel[] = [
  ...GLOBAL_FLAGS.map(({ name, description }) => ({
    long: name,
    description,
    takesValue: false,
  })),
  { long: LOG_LEVEL_FLAG.name, description: LOG_LEVEL_FLAG.description, takesValue: true },
];

export const describeCli = (): CommandModel[] => [
  ...commands.map(
    (definition): CommandModel => ({
      name: String(definition.name),
      description: definition.description,
      takesSlug: definition.args.some((arg) => arg.name === "slug"),
      flags: [
        ...flagSpecsFor(definition).map(
          (flag): FlagModel => ({
            long: flag.name.replaceAll(/\B([A-Z])/g, "-$1").toLowerCase(),
            ...(flag.short ? { short: flag.short } : {}),
            description: flag.description,
            takesValue: flag.type !== "boolean",
          }),
        ),
        ...outputFlags,
      ],
    }),
  ),
  uiCommandModel,
  completionsCommand,
];

/** A string as one single-quoted shell word (bash, zsh). */
const quoteSh = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

/** A string as one single-quoted fish word. */
const quoteFish = (value: string): string => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

/** The text of a zsh `_arguments` explanation, which ends at the first unescaped `]`. */
const zshExplanation = (value: string): string => value.replace(/[\\[\]]/g, "\\$&");

/** The name part of a zsh `_describe` entry, where `:` separates it from the description. */
const zshDescribeName = (value: string): string => value.replaceAll(":", "\\:");

const flagWords = (command: CommandModel): string[] => [
  ...command.flags.flatMap((flag) => [`--${flag.long}`, ...(flag.short ? [`-${flag.short}`] : [])]),
  `--${HELP.long}`,
  `-${HELP.short}`,
];

/** The flag of a slug-taking command that carries a slug as its value. */
const slugFlagOf = (command: CommandModel): FlagModel | undefined =>
  command.takesSlug ? command.flags.find((flag) => flag.long === "slug") : undefined;

/**
 * How a script gets the slugs while the user completes. They are kept in the running shell's own variables
 * (`__variant_slugs`, `__variant_dir`, `__variant_time`) and nowhere else: no file, nothing outliving the session. A
 * remembered list belongs to the directory it was gathered in and is fresh for 30 seconds.
 */
const BASH_SLUGS = [
  "# Bash 4.1 or newer can gather in the background through a descriptor; older bash gathers on demand.",
  "if [[ ${BASH_VERSINFO[0]} -gt 4 || (${BASH_VERSINFO[0]} -eq 4 && ${BASH_VERSINFO[1]} -ge 1) ]]; then",
  "  __variant_async=1",
  "else",
  "  __variant_async=0",
  "fi",
  '__variant_fd="${__variant_fd-}"',
  "__variant_fresh() {",
  "  __variant_have && ((SECONDS - __variant_time < 30))",
  "}",
  "__variant_have() {",
  '  [[ -n "${__variant_time-}" && "${__variant_dir-}" == "$PWD" ]]',
  "}",
  "__variant_remember() {",
  '  __variant_dir="$1"',
  '  __variant_time="$2"',
  '  __variant_slugs="$3"',
  "}",
  "__variant_gather() {",
  '  __variant_remember "$PWD" "$SECONDS" "$(command variant completions --list-slugs 2>/dev/null)"',
  "}",
  "# Gathering in the background: the output of a process substitution, read from a descriptor of this shell.",
  "__variant_start() {",
  '  [[ -n "$__variant_fd" ]] && return 0',
  '  __variant_fd_dir="$PWD"',
  "  __variant_fd_time=$SECONDS",
  "  exec {__variant_fd}< <(command variant completions --list-slugs 2>/dev/null)",
  "}",
  "# Takes in the gathering under way when it has ended; `wait` blocks until it does.",
  "__variant_harvest() {",
  '  [[ -n "$__variant_fd" ]] || return 1',
  '  if [[ "$1" != wait ]] && ! read -t 0 -u "$__variant_fd" 2>/dev/null; then',
  "    return 1",
  "  fi",
  "  local -a lines",
  "  local IFS=$'\\n'",
  '  mapfile -t -u "$__variant_fd" lines',
  "  exec {__variant_fd}<&-",
  '  __variant_fd=""',
  '  __variant_remember "$__variant_fd_dir" "$__variant_fd_time" "${lines[*]:-}"',
  "}",
  "__variant_prefetch() {",
  "  ((__variant_async)) || return 0",
  "  __variant_harvest",
  "  __variant_fresh && return 0",
  '  if [[ -n "$__variant_fd" && "$__variant_fd_dir" != "$PWD" ]]; then',
  "    __variant_harvest wait",
  "  fi",
  "  __variant_start",
  "}",
  "__variant_complete_slugs() {",
  "  if ((__variant_async)); then",
  "    __variant_harvest",
  "    if __variant_have; then",
  "      __variant_fresh || __variant_start",
  "    else",
  "      __variant_harvest wait",
  "      __variant_have || __variant_gather",
  "    fi",
  "  else",
  "    __variant_fresh || __variant_gather",
  "  fi",
  '  COMPREPLY=($(compgen -W "$__variant_slugs" -- "$1"))',
  "}",
];

const FISH_SLUGS = [
  "function __variant_slug_candidates",
  "    set -l now (date +%s)",
  '    if not set -q __variant_time; or test "$__variant_dir" != "$PWD"; or test (math $now - $__variant_time) -ge 30',
  "        set -g __variant_slugs (command variant completions --list-slugs 2>/dev/null)",
  "        set -g __variant_dir $PWD",
  "        set -g __variant_time $now",
  "    end",
  "    for slug in $__variant_slugs",
  "        echo $slug",
  "    end",
  "end",
];

const ZSH_SLUGS = [
  "# zsh/datetime is built in (no process). $SECONDS is not used: completion functions see it reset to 0.",
  "zmodload zsh/datetime",
  "__variant_fd=${__variant_fd-}",
  "__variant_have() {",
  '  [[ -n ${__variant_time-} && ${__variant_dir-} == "$PWD" ]]',
  "}",
  "",
  "__variant_fresh() {",
  "  __variant_have && ((EPOCHSECONDS - __variant_time < 30))",
  "}",
  "",
  "__variant_remember() {",
  "  __variant_dir=$1",
  "  __variant_time=$2",
  "  __variant_slugs=$3",
  "}",
  "",
  "__variant_gather() {",
  '  __variant_remember "$PWD" $EPOCHSECONDS "$(command variant completions --list-slugs 2>/dev/null)"',
  "}",
  "",
  "# Gathering in the background: the output of a process substitution, read from a descriptor that zle watches.",
  "__variant_start() {",
  "  [[ -n $__variant_fd ]] && return 0",
  '  __variant_fd_dir="$PWD"',
  "  __variant_fd_time=$EPOCHSECONDS",
  "  exec {__variant_fd}< <(command variant completions --list-slugs 2>/dev/null)",
  "  zle -F $__variant_fd __variant_slugs_ready",
  "}",
  "",
  "# Takes in the gathering under way: reads it to its end, stops watching its descriptor, and closes it.",
  "__variant_collect() {",
  "  local fd=$__variant_fd line",
  "  local -a lines",
  "  while IFS= read -r -u $fd line; do",
  "    lines+=($line)",
  "  done",
  "  zle -F $fd",
  "  exec {fd}<&-",
  "  __variant_fd=",
  '  __variant_remember "$__variant_fd_dir" "$__variant_fd_time" "${(F)lines}"',
  "}",
  "",
  "# zle calls this when the descriptor can be read, so the list lands without another keypress.",
  "__variant_slugs_ready() {",
  "  [[ -n $__variant_fd ]] && __variant_collect",
  "  return 0",
  "}",
  "",
  "__variant_prefetch() {",
  "  __variant_fresh && return 0",
  '  if [[ -n $__variant_fd && $__variant_fd_dir != "$PWD" ]]; then',
  "    __variant_collect",
  "  fi",
  "  __variant_start",
  "}",
  "",
  "_variant_slugs() {",
  "  if __variant_have; then",
  "    __variant_fresh || __variant_start",
  "  else",
  "    [[ -n $__variant_fd ]] && __variant_collect",
  "    __variant_have || __variant_gather",
  "  fi",
  "  local -a slugs",
  "  slugs=(${(f)__variant_slugs})",
  "  compadd -a slugs",
  "}",
];

const bash = (model: CommandModel[]): string => {
  const names = model.map((command) => command.name).join(" ");
  const cases = model.map((command) => {
    const slugFlag = slugFlagOf(command);
    const slugFlags = slugFlag ? [`--${slugFlag.long}`, ...(slugFlag.short ? [`-${slugFlag.short}`] : [])] : [];
    return `    ${command.name}) flags=${quoteSh(flagWords(command).join(" "))}; values=${quoteSh((command.values ?? []).join(" "))}; slug_flags=${quoteSh(slugFlags.join(" "))}; slug_pos=${command.takesSlug ? 1 : 0} ;;`;
  });
  return `${[
    "# bash completion for variant, generated by `variant completions bash`",
    ...BASH_SLUGS,
    "_variant() {",
    "  __variant_prefetch",
    "  local cur prev cmd flags values slug_flags slug_pos i",
    '  cur="${COMP_WORDS[COMP_CWORD]}"',
    '  prev="${COMP_WORDS[COMP_CWORD-1]}"',
    '  cmd=""',
    "  for ((i = 1; i < COMP_CWORD; i++)); do",
    '    case "${COMP_WORDS[i]}" in',
    "      -*) ;;",
    '      *) cmd="${COMP_WORDS[i]}"; break ;;',
    "    esac",
    "  done",
    '  if [[ -z "$cmd" ]]; then',
    '    if [[ "$cur" == -* ]]; then',
    `      COMPREPLY=($(compgen -W ${quoteSh(`--${HELP.long} -${HELP.short} --${VERSION.long}`)} -- "$cur"))`,
    "    else",
    `      COMPREPLY=($(compgen -W ${quoteSh(names)} -- "$cur"))`,
    "    fi",
    "    return 0",
    "  fi",
    '  case "$cmd" in',
    ...cases,
    '    *) flags=""; values=""; slug_flags=""; slug_pos=0 ;;',
    "  esac",
    '  if [[ -n "$slug_flags" && " $slug_flags " == *" $prev "* ]]; then',
    '    __variant_complete_slugs "$cur"',
    '  elif [[ "$cur" == -* ]]; then',
    '    COMPREPLY=($(compgen -W "$flags" -- "$cur"))',
    '  elif [[ "$slug_pos" == 1 ]]; then',
    '    __variant_complete_slugs "$cur"',
    "  else",
    '    COMPREPLY=($(compgen -W "$values" -- "$cur"))',
    "  fi",
    "}",
    "complete -F _variant variant",
  ].join("\n")}\n`;
};

const fish = (model: CommandModel[]): string => {
  const lines = [
    "# fish completion for variant, generated by `variant completions fish`",
    ...FISH_SLUGS,
    "complete -c variant -f",
    `complete -c variant -n __fish_use_subcommand -l ${HELP.long} -s ${HELP.short} -d ${quoteFish(HELP.description)}`,
    `complete -c variant -n __fish_use_subcommand -l ${VERSION.long} -d ${quoteFish(VERSION.description)}`,
  ];
  for (const command of model) {
    lines.push(
      `complete -c variant -n __fish_use_subcommand -a ${quoteFish(command.name)} -d ${quoteFish(command.description)}`,
    );
  }
  for (const command of model) {
    const scope = quoteFish(`__fish_seen_subcommand_from ${command.name}`);
    const slugFlag = slugFlagOf(command);
    for (const flag of command.flags) {
      const values =
        flag === slugFlag ? ` -x -a ${quoteFish("(__variant_slug_candidates)")}` : flag.takesValue ? " -r" : "";
      lines.push(
        `complete -c variant -n ${scope}${flag.short ? ` -s ${flag.short}` : ""} -l ${flag.long}${values} -d ${quoteFish(flag.description)}`,
      );
    }
    if (command.takesSlug) {
      lines.push(`complete -c variant -n ${scope} -a ${quoteFish("(__variant_slug_candidates)")}`);
    }
    lines.push(`complete -c variant -n ${scope} -l ${HELP.long} -s ${HELP.short} -d ${quoteFish(HELP.description)}`);
    if (command.values && command.values.length > 0) {
      lines.push(`complete -c variant -n ${scope} -a ${quoteFish(command.values.join(" "))}`);
    }
  }
  return `${lines.join("\n")}\n`;
};

const zshFlagSpec = (flag: FlagModel, slugFlag: FlagModel | undefined): string => {
  const explanation = `[${zshExplanation(flag.description)}]`;
  const action = flag.takesValue ? `:${flag.long}:${flag === slugFlag ? "_variant_slugs" : "_nothing"}` : "";
  if (!flag.short) {
    return quoteSh(`--${flag.long}${flag.takesValue ? "=" : ""}${explanation}${action}`);
  }
  const exclusive = quoteSh(`(--${flag.long} -${flag.short})`);
  const forms = `{--${flag.long}${flag.takesValue ? "=" : ""},-${flag.short}${flag.takesValue ? "+" : ""}}`;
  return `${exclusive}${forms}${quoteSh(`${explanation}${action}`)}`;
};

const zshHelpSpec = `'(- *)'{-${HELP.short},--${HELP.long}}'[${HELP.description}]'`;

const zsh = (model: CommandModel[]): string => {
  const entries = model.map((command) => `    ${quoteSh(`${zshDescribeName(command.name)}:${command.description}`)}`);
  const blocks = model.flatMap((command): string[] => {
    const specs = [
      ...command.flags.map((flag) => zshFlagSpec(flag, slugFlagOf(command))),
      zshHelpSpec,
      ...(command.takesSlug ? [quoteSh("1:slug:_variant_slugs")] : []),
      ...(command.values && command.values.length > 0 ? [quoteSh(`1:value:(${command.values.join(" ")})`)] : []),
    ];
    return [
      `        (${command.name})`,
      "          _arguments -s \\",
      ...specs.map((spec, index) => `            ${spec}${index < specs.length - 1 ? " \\" : " && ret=0 ;;"}`),
    ];
  });
  return `${[
    "#compdef variant",
    "# zsh completion for variant, generated by `variant completions zsh`",
    "",
    ...ZSH_SLUGS,
    "",
    "_variant() {",
    "  __variant_prefetch",
    '  local curcontext="$curcontext" state line ret=1',
    "  typeset -A opt_args",
    "  local -a variant_commands",
    "  variant_commands=(",
    ...entries,
    "  )",
    "  _arguments -C \\",
    `    ${zshHelpSpec} \\`,
    `    '(- *)--${VERSION.long}[${VERSION.description}]' \\`,
    "    '1: :->command' \\",
    "    '*:: :->args' && ret=0",
    "  case $state in",
    "    command)",
    "      _describe -t commands 'variant command' variant_commands && ret=0 ;;",
    "    args)",
    "      case $words[1] in",
    ...blocks,
    "      esac ;;",
    "  esac",
    "  return ret",
    "}",
    "",
    'if [ "$funcstack[1]" = "_variant" ]; then',
    '  _variant "$@"',
    "else",
    "  compdef _variant variant",
    "fi",
  ].join("\n")}\n`;
};

const generators: Record<Shell, (model: CommandModel[]) => string> = { bash, fish, zsh };

/** The completion script of a shell, rendered from the model of the CLI. */
export const generateCompletions = (shell: Shell, model: CommandModel[] = describeCli()): string =>
  generators[shell](model);

export const isShell = (value: string | undefined): value is Shell => SHELLS.some((shell) => shell === value);
