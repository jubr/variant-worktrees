## Context

See [proposal.md](proposal.md) for why. Behavior is [specs/variant-config/core | Config CLI command](specs/variant-config/core/spec.md).

`loadConfig` returns one resolved object. `environment` is already a non-enumerable property, so it is absent from `Object.entries`, `JSON.stringify`, and the YAML serializer. `db` and `source` are enumerable getters. `detectConnection` already records `source` (`env` or `default`) and `variables`, the environment name that supplied each database field. The CLI prints `config` with `outline()` because that command has no text layout: indented `key: value` lines, empty collections as `[]` or `{}`, strings through the YAML serializer, password replaced by `redacted()` before that. `--json` and `--yaml` serialize the same enumerable object. Log lines already choose color with `isTTY && NO_COLOR === undefined`. The CLI test harness sets `NO_COLOR`.

The published wording of this requirement still says the command prints JSON. The running command prints text unless `--json` or `--yaml` is passed. This change follows the running command.

## Goals / Non-Goals

**Goals:**

- One origin recorded per printed value, produced while the configuration is resolved.
- Comments collapsed onto a parent whose children share that origin.
- One walker that prints the config text, so the comment and the color see the value's type.
- Color chosen the same way a log line chooses it, on stdout.

**Non-Goals:**

- See [proposal.md](proposal.md). In particular, no yq process and no color applied by scanning the finished text.

## Decisions

**Origins are a non-enumerable map on the resolved configuration, keyed by path.** The same hiding that keeps `environment` out of the printed object keeps the map out of `--json`, `--yaml`, and the MCP payload. The CLI reads the map off the object it is about to print and passes it into the renderer beside the redacted value, so a clone inside `redacted()` cannot drop it. Alternative: a sibling field `origins` on the result. Rejected: it would appear in `--json`. Alternative: recompute the origin in the CLI from the printed strings. Rejected: redaction has already replaced the password, and a string no longer shows whether it was a default.

**Classify each path once, after resolve, by comparing the raw file to the resolved value.** The stored comment text is the text the printer uses.

- A literal in the raw file, or a `${NAME:-fallback}` whose variable is unset, is `# from <path>`. `<path>` is `configPath` relative to the process cwd: `/` separators, `./` when the file is inside the cwd, `..` when it is not. `path.relative` of `variants.yaml` in the cwd becomes `./variants.yaml`. The same rule names a worktree file and the main file; there is no `worktree` token and no merge of the two files.
- A `${NAME}` or a `${NAME:-fallback}` whose variable is set is `# from env NAME`.
- A key the file omits and a built-in `??` fills (prefix, ports, supervise, implode, steps, chat-renamer defaults, the sqlite fallback connection) is `# default`.
- A database field named in `variables` is `# from env NAME`. The dialect, which is not one of those fields, is `# from env <NAME>` for the variable `detectDialect` consulted when `source` is `env`, and `# default` when `source` is `default`.
- A database field with no variable is `# autodetect connection` on a detected connection (the null slots included) and `# default` on the sqlite fallback.
- Discovered values the file does not set use one reason word: `main`, `root`, `abbr`, `watch`, `config` (`configPath` and `configDir`), `runtime` (operational state). `source` is `# autodetect connection`.
- Items of a sequence share that sequence's origin.
- There is no `# from env` without a variable name. A value the environment supplied with no recorded variable is `# autodetect connection`.

Alternative: store the origin on every leaf as a `{ value, origin }` pair inside the resolved object. Rejected: every consumer of `db.host` and `variant.prefix` would have to unwrap it.

**The printer comments the highest node that owns an origin.** A mapping's origin is the file that contains that key, or `# default` / `# autodetect <reason>` when the resolver introduced the key. The comment is printed on that key. A child with the same origin is not commented. A child with a different origin is commented on its own line, which is the override. A key whose descendants all share one origin therefore shows that comment once, on the key. The walker emits the outline the CLI already prints, then appends the comment on those lines only. It knows the JavaScript type, so a boolean is magenta and the string `"true"` is green. Color wraps the key characters in `ESC[36m`, string characters (quotes included) in `ESC[32m`, number and boolean characters in `ESC[95m`, and the comment from `#` in `ESC[90m`. Spaces, the colon, `null`, `[]`, `{}`, and dashes stay uncolored. `ESC[0m` closes each span. Empty resets like yq's `ESC[36mESC[0m` are not emitted. Alternative: stringify with the YAML library and color with a regular expression. Rejected: the library drops comments, and a regular expression cannot tell a boolean from the string `true` or a number inside a path. Alternative: comment every leaf and never the parent. Rejected: a mapping from one file would repeat the same path on every line.

**Stdout color uses the log rule.** `renderOutput` takes an optional `color` and applies it only on the `config` text path. The CLI sets it from `process.stdout.isTTY === true && process.env.NO_COLOR === undefined`. Other commands ignore it. Tests pass `color: true` into the renderer the way `formatLogEvent` tests pass `isTTY`, because the harness sets `NO_COLOR` and a pipe is not a terminal.

## Risks / Trade-offs

- [A new resolved key is printed with no origin] → The walker requires an origin for every value that is not covered by an ancestor comment. The test that every such line ends with one of the four comment forms fails until the classifier names it.
- [A string contains `#`] → The walker quotes the way `outline()` already quotes, and appends the comment after that token, so the `#` of the value stays inside the quotes.
- [Redaction runs before the comment is chosen] → The comment is looked up in the map by path. The printed password is `***` either way.
- [A relative path depends on cwd] → The path is computed from the cwd passed to `loadConfig`, not from `configDir`. A test fixes cwd and the file and asserts `./variants.yaml` or `../variants.yaml`.

## Migration Plan

No state migration and no change to `variants.yaml`. Rollback is reverting the change. The docs and the changelog ship with the code.

## Open Questions

None.
