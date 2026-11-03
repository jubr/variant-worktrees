## Context

See proposal.md for motivation. Autodetection exists in `variant-config` (`detectConnection`, `detectInstances`,
`abbreviate`, `findConfigFile`) and runs on every `loadConfig`. `commands.ts` in `variant-api` drives the CLI, MCP tools
and shell completions from one list, and `scripts/docs-coverage.spec.ts` fails for a registered command missing from
README and docs. Only requests that need the editor use the extension socket; the extension calls `variant-api`
in-process for its own actions.

The Explorer section `Variant Worktrees` is a tree view (`variant.variants`); `variants-expand.ts` already focuses it
with the generated command `variant.variants.focus`. A view is a tree or a webview, never both, and the VS Code API has
no native modal with an input and checkboxes and no way to set the size of a section.

The `schema-config-etc` change renames `instances` to `watches` and defaults `dir` to the key. This change's specs use
those names; it lands after that change, and code written before then uses the old names and is renamed on rebase.

## Goals / Non-Goals

**Goals:**
- One implementation of the three init steps shared by CLI, MCP and editor; the editor adds only UI and triggering.
- Output that is a valid, round-tripping `variants.yaml`, readable as documentation, with no secret in it.
- Trigger logic testable without a real editor or real git.

**Non-Goals:**
- A CLI wizard, or merging into an existing `variants.yaml`.
- Autodetecting script watches when `variant.watches` is absent: runtime behavior of existing projects stays as it is;
  only `init` writes them.
- Adding `variants.local.yaml` to `.gitignore`.

## Decisions

**Renderer in `variant-config`, operation in `variant-api`.** `renderInitConfig(dir, { prefix })` builds the document;
`variant-api/operations/init.ts` does the file, `.gitignore` and mise-configuration I/O, the existing-file check and the step
results, and `client.init` exposes it. Rendering sits next to the schema it must agree with; I/O sits with the other
operations. Alternative: render in the CLI only — rejected, the editor and MCP need it and must not reach the CLI.

**Build with the `yaml` Document API, not string templates.** The `yaml` package (already a dependency) lets a
value carry a same-line comment and guarantees valid output. A table of alternatives per key (`dialect`, `kind`, `ssl`,
`abbr`, `prefix`) supplies the comments, in the style of `variants.example.yaml`: the other values after `#`, the
current one not repeated. A test parses the output with `VariantsConfigSchema`, loads it, and compares the resolved
database with the autodetected one (the round trip), which also guards against drift when the schema grows.
Alternative: a string template — easier to read, but drifts from the schema and mis-quotes values.

**Placement: executable in `variant-config`, the rest in `variant-api`.** `resolveMiseBinary` is in `variant-config`
because `variants.yaml` carries `variant.mise.binPath` and `loadConfig` must be able to resolve the executable.
Everything that runs Mise (environment, `set`, `config ls`, `trust`, the augment step, `MiseError`) is a
`variant-api` module, because the CLI and MCP server reach Mise only through `variant-api`, and `variant-api` already
depends on `variant-config`. The reverse dependency is avoided by injection: `loadConfig` takes a lazy
`environment: () => NodeJS.ProcessEnv` option (default: the process environment) and the resolved configuration reads
it on first use. `variant-api` exports a loader that wires its Mise-backed provider (using
`resolveMiseBinary({ configured: editorPath, fromConfig: config.variant.mise?.binPath })`) and the CLI, MCP server and
extension call that loader. Detection helpers that need the environment (`detectConnection`, `detectOnboarding`, the
init renderer) take the same provider. Alternative: put the runner in `variant-config` and let `variant-api` re-export
it - rejected: it would make the config parser own process spawning for the trust and augment features too.

**Environment: lazy, through Mise, one call.** Today `detectConnection` parses the nearest mise file with
`smol-toml` on every `loadConfig`, whether or not the command needs a value. It is replaced by the memoized provider
above: the first caller runs `mise -C <configDir> env --dotenv --quiet`, parses the dotenv output (the existing
`dotenv.ts` gains a reader), and merges it over `process.env`. `db` on the resolved configuration becomes a memoized
lazy property, and `${NAME}` is expanded at the use site, so `variant list` and other commands without environment
needs start no process. Mise is the authority: it handles every official file name, `mise.<env>.toml`, precedence, trust
and templating, which a parser of one file cannot. A missing Mise executable means the process environment alone (an
environment such as CI or a container without Mise must keep working); a failing `mise` is an error rather than a
silent fallback, because defaulting to SQLite after an untrusted-config failure would point a variant at the wrong
database. The editor reports it with a Trust option (below) and treats the check as "nothing detected". `findMiseFile`
and `readMiseEnvironment` go away; the `misePath` of the detection result is replaced by variable sources.
Alternative: keep parsing `mise.local.toml` - rejected by the user's direction, and it misses `.config/mise.toml`.

**`resolveMiseBinary` finds Mise before anything runs it.** An editor started from the desktop often has a `PATH` without
Homebrew or `~/.local/bin`, so `mise` is "not installed" for the extension while it works in a terminal. The function
takes, in order, the path the caller passes (the extension fills it from its setting `variant.mise.binPath`), the
`variant.mise.binPath` key of `variants.yaml` (relative values resolve against that file), `PATH`, then a fixed list of
usual locations, and returns the first executable. A configured path that does not work is an error, not a
fall-through: a typo would otherwise silently select another Mise. The CLI and MCP server pass no path, so they get the
key, `PATH` and the list. The editor setting exists because a path is machine-specific; the key is the per-project
alternative and, being in a committed file, should be used only when the whole team shares the path. Mise failures
are a `MiseError` (directory, message, `untrusted` when Mise's message says "not trusted"), so callers can offer a fix without parsing
text.

**Mise failures in the editor offer Trust.** The extension routes every in-process call through one wrapper that
catches `MiseError`, shows one error notification per (directory, kind) per session, adds `Trust` for `untrusted`, runs
`mise -C <dir> trust --all` with the resolved executable, and repeats the failed action. `--all` is used because
the message names a file that can be in a parent directory and mise trusts per file; it trusts the files in the
directory and its parents, which is exactly the set `mise env` just refused. Trust is an explicit button and never
automatic, since trusting runs hooks and templates from the repository.

**Variable sources by `mise set`.** `mise -C <dir> set --raw --quiet` prints `KEY VALUE SOURCE` per variable (the source
abbreviates the home directory as `~`). It is run only by `variant init` to write the `# from ../mise.local.toml`
comment; a key it does not list is from the process environment. Parsing takes the first token as key and the last as
source, so a source path with spaces is not supported and falls back to `# from mise`. `config ls` could not replace it
here: it reports files, not which file defines which variable.

**One interpolation syntax, `${...}`, at every use site.** `renderTemplate` takes `${slug}`, `${port}`, `${<key>.port}`,
`${NAME}`, `${NAME:-default}` and `$${` as the escape. It is applied where a value is used, to commands and
paths as well as to `env`, `url` and `db`; regular-expression settings are exempt. Two passes stay (variant
placeholders, then environment) so a default may hold a placeholder. Shell text such as `${HOME}` in a command now
reaches the engine; an unset name is an error, so the escape `$${HOME}` is the documented way to pass it through
(`${HOME}` resolves to the same value on the same machine anyway). Alternative: leave unknown names alone - rejected,
it hides a mistyped secret name. The old `{{...}}` form is read by the legacy path of `schema-config-etc` (notice, then
rewrite by CLI or extension) so no file breaks on upgrade; the rewrite must handle the nested default
`{{A:-{{slug}}}}`. `variants.local.yaml` (the `{{POSTGRES_PORT}}` template of `runtime.db.port`) migrates the same way.
Specification text that still shows `{{...}}` stays correct under the legacy rule and is swept to `${...}` when the
change is sync-archived.

**Secrets become environment references.** The file is committed, the environment is not. Init needs to know which
variable supplied a value, so `detectConnection` also returns the variable name per field; the renderer writes
`${KEY}` for a password and for a `DATABASE_URL` that carries a password, with `# from <relative path>` using the
`mise set` source, or `# from the environment`; everything else is literal. Explicit config keeps winning per key
(`mergeDbConfig`). `MYSQL_*` wins over `MARIADB_*` per setting; the dialect is `mysql` for both (the schema has no
`mariadb` dialect and the drivers are the same). The notification label says `mariadb` when only MariaDB signals
exist, so it matches what the person sees in their mise file.

**Script watches: init only, no kind.** `detectScriptWatches(dir)` walks like `detectInstances` (same skip list),
returns directories whose `package.json` has a watch-like script (name equals `watch` or has `watch` as a segment
split on `:`, `-`, `_`, `.`; first in file order) and that are not Vite or NestJS. The command is
`<runner> run <script>` with the runner from the lockfile (`bun`, `pnpm`, `yarn`, else `npm`), looked up in the
directory then the project directory. The same function feeds the notification (`package-script-watch`). It makes
`kind` optional in `VariantWatchSchema` rather than inventing a kind: `kind` has no consumer in the code besides the
schema, and the user's target shape is `watches.<dir>.watch`. Keys come from the existing key function, with `app`
standing in for the missing kind in the project directory. `dir` is omitted when it equals the key
(`schema-config-etc` default).

**The Mise step finds the file with Mise and edits it as text.** `mise -C <dir> config ls --json` lists every config
file Mise would load (any official name and location, with the tools each holds), closest directory first. The step
keeps the entries inside the git checkout of the directory (so the edit is committed with the project; the global
configuration falls out here), drops those with `.local.` in the file name (git-ignored), and takes the first: the
closest match. With none left it creates `mise.toml` in the directory. `mise set` was not usable for this: it lists
only files that define variables. The edit is textual so comments and ordering survive: `smol-toml` decides (tools
table without the tool -> insert after the `[tools]` header; no `tools` -> append a table; tool present in any quoting
-> unchanged; parse error or inline/dotted `tools` -> unchanged with a reason). `mise use` was rejected: it downloads
and installs a release and writes to whichever file it picks. The entry is `"github:jubr/variant-worktrees" =
"latest"`, what `mise use` writes per the README. No Mise executable -> the step says Mise was not found, names the
places searched and `variant.mise.binPath`, and changes nothing. The behavior is specified in `tools/mise`; `init` only
calls it.

**Command shape.** `init` joins `commands[]` with `prefix` (string), `force` (boolean) and the step switches `file`,
`gitignore`, `mise` (boolean, default true; `--gitignore=false` turns one off; `mise` is the step that augments the mise configuration). Names avoid `--yaml` and `--config`,
which are global flags. It takes no slug. Steps are independent: one failing step is reported while the others still
run, and the result lists each step's outcome. It is an MCP tool because the generator derives one per command and
an agent bootstrapping a repo is a fair use; it is not a lifecycle command and that requirement is untouched.

**Dialog lives in the Explorer section; the tree swaps out while it is open.** A new webview view `variant.onboarding`
(titled `Variant Worktrees`, same Explorer container) has `when: variant.onboardingOpen`; `variant.variants` gets
`!variant.onboardingOpen`. `variant.onboardingInit` sets the context, then runs `variant.onboarding.focus`, which opens
the Explorer, expands the section and focuses it. `Cancel`/`Init` clear the context and focus `variant.variants` (or
the editor after `Init` opens the file). There is no API to resize a section, so the dialog is built to need no
resizing: a single narrow column that scrolls, with the section taking the slot of the tree; a manifest
`initialSize` hint may be added where the host honors it and is not relied on. Alternatives: an editor-tab
`WebviewPanel` — rejected, the request is to show it in the Explorer; a second pane next to the tree — rejected, two
Variant sections would compete for space and the user asked for the same pane; hiding the file tree — not possible
from an extension. The hand-written HTML (intro, existing `media/icon-128.png` at the top right, one input, three
checkboxes, two buttons, CSP nonce, theme variables) is used instead of the React app of `variant-ui`, which is wired
to the variants transport and bundle this dialog does not need. Messages `init` and `cancel` go to the extension,
which calls `variant-api` in-process, then refreshes the variants store so the tree sees the new `variants.yaml`.

**Commit detection by reflog.** The extension watches the file given by `git rev-parse --git-path logs/HEAD` (correct
in linked worktrees) with `vscode.workspace.createFileSystemWatcher` and, on change, reads the last line. A reflog
message starting with `commit` (`commit:`, `commit (initial):`, `commit (amend):`, `commit (merge):`) marks a local
commit; `pull`, `merge`, `rebase`, `checkout`, `clone` do not. The last line at activation is read and ignored, so
only commits made while the extension runs trigger. Alternative: the built-in `vscode.git` extension API — rejected
as the primary signal, since its commit event is not available in every host (Cursor) and cannot be driven from tests.
The watcher is behind a small interface so tests inject entries.

**Onboarding gate order.** On a commit: no state record → no config found (`findConfigFile`, so a workspace under a
parent that has the file counts as configured) → `detectOnboarding(dir)` (no database access; one `mise env` run, treated as "nothing detected" when it fails) → notification →
record in `workspaceState` immediately after showing, so a dismissed or ignored notification does not return.
`detectOnboarding` returns the database label when the dialect is `postgres`, `mysql` or `sqlite` and was actually
detected (`source !== "default"`) and the distinct application kinds.

## Risks / Trade-offs

- [The section cannot be resized] → the swap puts the dialog in the tree's slot and the content scrolls; if the host
  gives the section little height the dialog is still usable. Revisit with a host that offers sizing.
- [Hiding the tree while the dialog is open] → the dialog is short-lived; `Cancel` restores it, and the context is
  cleared on dispose so a reload never leaves the tree hidden.
- [Unset `${NAME}` fails in environments without the variable, e.g. CI] → the error names setting and variable;
  `${NAME:-default}` is the documented escape, and nothing is evaluated for commands that never use the value.
- [`${...}` in existing shell commands now means interpolation] → `$${` escape, documented and in the migration
  notice text; the unset-name error points at it.
- [`{{...}}` → `${...}` is a breaking change across docs, examples, specs and tests] → legacy read plus rewrite keeps
  files working; the sweep is mechanical and covered by the docs example test of `schema-config-etc`.
- [`mise env` costs a process start (tens of ms) when the first value is needed] → once per loaded configuration, never
  for commands that need none; the editor calls it only for workspaces without a configuration and before the one-time
  notification.
- [`package-script-watch` has no autodetection at runtime, so a project that deletes its `variants.yaml` loses the
  watch] → intended; the written file is the source of truth for script watches.
- [Reflog format differs across git versions or when reflogs are disabled (`core.logAllRefUpdates=false`)] → no
  notification; the command remains available. Covered by the "not a local commit" scenarios with fixture lines.
- [Optional `kind` touches the schema that `schema-config-etc` also edits] → added as a separate requirement and
  merged after that change; the JSON schema for editors is regenerated from Zod.
- [Writing `variants.yaml` makes autodetection explicit: later environment changes no longer flow into listed keys]
  → intended; the file is for editing, and the comments say what else is possible. Secret references keep following
  the environment.
- [Text edit of the mise file misses exotic layouts] → unchanged file plus a reason instead of a guess.

## Migration Plan

Additive. Existing `variants.yaml` files without `${` keep their values, and `kind` stays valid. Rollback: revert the
commits; a file written by `init` is an ordinary file the user owns.
