## 1. Ligatures

- [ ] 1.1 In `scripts/docs-site.spec.ts` add failing tests for [specs/docs/site | Code does not use ligatures](../../specs/docs/site/spec.md#requirement-code-does-not-use-ligatures): the built stylesheet turns ligatures off for `code` and `pre`, and the built Overview page keeps `VARIANT_STEP_<STEP>=no` as typed text. Verify the stylesheet test fails first.
- [ ] 1.2 Set `font-variant-ligatures: none` and `font-feature-settings: "liga" 0, "calt" 0` for `code, pre` in `docs/.vitepress/theme/custom.css`. Verify `bun test scripts/docs-site.spec.ts` passes and that `<STEP>=no` shows as typed in the browser.

## 2. Configuration page

- [ ] 2.1 Add failing tests for the modified [Configuration page structure](../../specs/docs/site/spec.md#requirement-configuration-page-structure): an `h3` for every sub-key path of `variant` derived from the schema (`<key>` for watches, `<name>` for steps), every key of `db` including `db.multi.*`, `variants.<slug>.seed`, the Database and Variants sections between Options and Templates,  all `variant.` headings in alphabetical order, the `chatRenamer.*` entry last in Options with its link, the `variant.steps` link to `overview#flow-of-steps`, and the Templates table with its thirteen rows. Verify they fail first. Check in the built HTML which `id` a heading with `<key>` gets, and use that in the tests.
- [ ] 2.2 Turn the options tables of `variant.implode`, `variant.ports`, `variant.storage`, `variant.supervise`, `variant.ui`, `variant.mise`, `variant.steps` and `variant.watches` (including its *Watch options* table and `container`) into one `h3` with a paragraph per sub-key, and add a *Database* section (`db.dialect`, `db.url`, `db.host`, `db.port`, `db.user`, `db.password`, `db.database`, `db.schema`, `db.filename`, `db.ssl`, `db.multi` and its three keys; take wording from the schema descriptions, the README and the Runtime page) and a *Variants* section with `variants.<slug>.seed`. Verify the sub-key tests pass.
- [ ] 2.3 Rewrite *Templates* as a table (item, pass, meaning, example), add the `chatRenamer.*` entry at the end of *Options*, and link `variant.steps` to `./overview#flow-of-steps`. Verify the templates, `chatRenamer.*` and steps tests pass.
- [ ] 2.4 Add the failing test for [No earlier configuration shapes in the docs](../../specs/docs/site/spec.md#requirement-no-earlier-configuration-shapes-in-the-docs), then remove the earlier names and shapes from `docs/` (Configuration *Unknown keys and migration*, *Templates*, `variant.steps`, Runtime state-file sentence), keeping the mechanism of the in-place rewrite. Verify the test passes.
- [ ] 2.5 Commit the group: tests and pages together, `bun test scripts/docs-site.spec.ts` green.

## 3. Runtime page

- [ ] 3.1 Add the failing scenario *Watching holds the attached-watch behavior* of [Runtime page](../../specs/docs/site/spec.md#requirement-runtime-page) to `scripts/docs-site.spec.ts`. Verify it fails first.
- [ ] 3.2 In `docs/guide/runtime.md` create the `Watching` heading with *Interactive keys*, *Reattaching* and *Exit status* as `h3`, and a new `Up` heading after it holding what is specific to `up`. Verify the test and the existing runtime tests pass.
- [ ] 3.3 Commit the group, `bun test scripts/docs-site.spec.ts` green.

## 4. MCP page and Chat Renamer configuration

- [ ] 4.1 Add failing tests for [MCP tools have a heading each](../../specs/docs/site/spec.md#requirement-mcp-tools-have-a-heading-each) (headings and parameter rows from the registered commands, Core links, no row for fixed arguments) and [Chat Renamer configuration page structure](../../specs/docs/site/spec.md#requirement-chat-renamer-configuration-page-structure) (headings from the schema, alphabetical). Verify they fail first.
- [ ] 4.2 Rewrite *Available tools* in `docs/mcp.md` as one `h3` per tool with its Core link, the differences from the CLI and a parameter table. Verify the MCP tests pass.
- [ ] 4.3 Restructure `docs/chat-renamer/configuration.md` like the Configuration page: Options with an `h3` per `chatRenamer.<key>` and sub-key, then the editor settings. Fix links from the Chat Renamer overview, Extension and Configuration. Verify the chat renamer tests pass.
- [ ] 4.4 Add the test for [Configuration schema is documented](../../specs/docs/site/spec.md#requirement-configuration-schema-is-documented): walk every property path of `packages/variant-config/variants.yaml.schema.json` and require a heading of that path on the built Configuration or Chat Renamer configuration page, with the missing paths in the failure message. It passes only now that groups 2 and 4 are done; prove it can fail by temporarily removing one heading, then restore it.
- [ ] 4.5 Commit the group, `bun test scripts/docs-site.spec.ts` green.

## 5. Deep links

- [ ] 5.0 Check in the pinned VitePress 2.0 alpha what its dead-link check covers (it ignores fragments and links outside markdown content in 1.6.4) and record the result in chat. Add the failing tests for [Internal links resolve](../../specs/docs/site/spec.md#requirement-internal-links-resolve): every internal `href` of every built page, including navigation, sidebar and one link in the API reference, resolves to a file in `docs/.vitepress/dist`. Verify it can fail by checking it against a deliberately broken link, then remove that link.
- [ ] 5.1 Add failing tests for [Links target headings](../../specs/docs/site/spec.md#requirement-links-target-headings) (no dead fragment on any built page, the named deep links), [Configuration keys are links](../../specs/docs/site/spec.md#requirement-configuration-keys-are-links) and [Overview steps are short and link to commands](../../specs/docs/site/spec.md#requirement-overview-steps-are-short-and-link-to-commands), plus the library scenario of [Library page shows code](../../specs/docs/site/spec.md#requirement-library-page-shows-code). Verify they fail first.
- [ ] 5.2 Reshape `docs/guide/overview.md`: first move into Core what only the Overview says (step replacement of `provision` and `deprovision` with `db.multi`, `--reprovision` of `watch`), then cut `create`, `provision`, `watch`, `down`, `deprovision` and `implode` to at most 60 words with no list, table or example, each ending `More details at [<command>](core#<command>).`. Keep `seed`, Custom Steps and Custom multi-tenancy steps in full, and link their keys (`variant.steps`, `variant.seed`, `db.multi`, `db.multi.schemaPrefix`). Verify the Overview and Core scenarios pass and that no fact was lost, by diffing the removed sentences against Core.
- [ ] 5.3 Link every key mention on Core, Runtime, Library, Extension, Getting Started, Installation, Socket IPC, Building, the landing page and the Chat Renamer pages to its heading; add deep links from those pages to the headings that explain what they name (Getting Started to `overview#flow-of-steps`, Extension to `runtime#watching`, and so on).
- [ ] 5.4 Replace the *Configuration* section of `docs/guide/library.md` with deep links into the Configuration page and drop the sample file.
- [ ] 5.5 Fix links in `README.md` and `packages/*/README.md` that point at renamed headings. Verify `bun test scripts/docs-site.spec.ts` passes.
- [ ] 5.6 Commit the group.

## 6. Wrap up

- [ ] 6.1 Add a `CHANGELOG.md` entry under Unreleased.
- [ ] 6.2 Open the built site in the browser and check the Configuration outline, an MCP tool section, the Runtime outline, and that `VARIANT_STEP_<STEP>=no` renders as typed. Report the observation in chat.
- [ ] 6.3 Run `openspec validate --all --strict --no-interactive` and `task check:full`.
