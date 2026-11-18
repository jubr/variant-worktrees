## ADDED Requirements

### Requirement: Code does not use ligatures

Code on the documentation site, inline and fenced, SHALL show every character as typed. The built stylesheet SHALL turn font ligatures and contextual alternates off for `code` and `pre`, so `>=`, `<=`, `=>`, `!=` and `->` are not drawn as one glyph. The page text SHALL keep the typed characters.

#### Scenario: Stylesheet turns ligatures off for code

- **WHEN** the built stylesheet is read
- **THEN** a rule for `code` and `pre` sets `font-variant-ligatures` to `none`
- **AND** the same rule turns the `calt` and `liga` font features off

#### Scenario: Inline code keeps the typed characters

- **WHEN** the built Overview page is read
- **THEN** its inline code contains `VARIANT_STEP_<STEP>=no` with the characters `<`, `>` and `=` as text (escaped in HTML only)

### Requirement: Links target headings

A link from one documentation page to another SHALL target the heading that explains the topic whenever such a heading exists, as in `overview#flow-of-steps`, `core#init` and `configuration#variant-steps`. Every internal link that has a fragment SHALL name an `id` that exists in its built target page.

#### Scenario: No link has a dead fragment

- **WHEN** every internal link with a fragment in the built site is resolved against its target page
- **THEN** the target page contains an element with that `id`

#### Scenario: Pages link into the heading that explains the topic

- **WHEN** the built Getting Started, Configuration, Core, Installation, Extension and Socket IPC pages are read
- **THEN** Getting Started links to `/guide/overview#flow-of-steps`
- **AND** the `variant.steps` section of Configuration links to `/guide/overview#flow-of-steps`
- **AND** Core links to Configuration headings, not to the top of Configuration, where it names a key
- **AND** Socket IPC links to `/guide/runtime`, the Extension page links to `/guide/runtime#watching`

### Requirement: Internal links resolve

Every internal link in a built page of the documentation site (a link that is not to another origin), resolved against its page, SHALL name a file in the build output, and when it has a fragment, an element with that `id` in that file. This covers links in the page content, the navigation bar, the sidebar and the footer, including links written as raw HTML.

#### Scenario: Every internal link names a file

- **WHEN** every internal `href` of every built HTML page is resolved against its page
- **THEN** each resolves to a file in the build output, where a path without extension or with a trailing slash names the `.html` file or the `index.html` of that path

#### Scenario: The check sees links the build does not

- **WHEN** the test collects links from the built pages
- **THEN** it includes the navigation and sidebar links and at least one link inside the generated API reference

### Requirement: Configuration schema is documented

Every property path of the `variants.yaml` JSON schema (`packages/variant-config/variants.yaml.schema.json`, which the `variant-config` and `chat-renamer-config` packages generate) SHALL have a heading of its own on the Configuration page or the Chat Renamer configuration page, named with the full path. A path through a user-chosen name SHALL be written with a placeholder: `<key>` for a watch and `<name>` for a step. The former per-variant state schema `variants.local.yaml.schema.json` is exempt.

#### Scenario: Every schema path has a heading

- **WHEN** all property paths of the `variants.yaml` JSON schema are listed (objects and leaves, such as `db.ssl`, `db.multi.tenantsCmd`, `variant.supervise.readyTimeoutSeconds` and `chatRenamer.awake.cmd`)
- **THEN** each one is the text of a heading of the built Configuration page or the built Chat Renamer configuration page

#### Scenario: A key without documentation fails

- **WHEN** a property is added to the schema and no heading is added
- **THEN** the documentation test fails and names the path

### Requirement: Configuration keys are links

Every inline-code mention in the documentation of a full key path that has a heading on the Configuration page or the Chat Renamer configuration page, such as `variant.baseBranch`, `variant.mise.binPath`, `variant.watches.<key>.dir`, `db.multi`, `chatRenamer.trigger` or `chatRenamer.awake.when`, SHALL be a link to that heading. A heading is exempt from this, and so is fenced code.

#### Scenario: A mentioned key links to its heading

- **WHEN** the built pages are read
- **THEN** each inline `code` element outside a heading and outside fenced code whose text is the path of a heading of the Configuration or the Chat Renamer configuration page is the content of a link to that heading
- **AND** the check finds at least one such mention on each of Overview, Runtime, Core, Library and Extension

#### Scenario: Chat Renamer pages link to the Chat Renamer keys

- **WHEN** the built Chat Renamer overview page mentions `chatRenamer.trigger`
- **THEN** the mention links to `/chat-renamer/configuration#chatrenamer-trigger`

### Requirement: Overview steps are short and link to commands

Each builtin step of the Overview that is also a command (`create`, `provision`, `watch`, `down`, `deprovision`, `implode`) SHALL be a minimal explanation of what the step does, of at most 60 words, with no list, no table, no flag or option list and no configuration example. It SHALL end with the sentence `More details at [<command>](core#<command>).`, linking to the section of that command in Core. What the step no longer says SHALL be in that Core section. A step that is not a command, `seed`, and the Custom Steps and Custom multi-tenancy steps sections SHALL keep their full explanation and full configuration example, and SHALL link to the headings of the keys they use, such as `variant.steps`, `variant.seed`, `db.multi` and `db.multi.schemaPrefix`. The Overview SHALL show `VARIANT_STEP_<STEP>=no` as typed.

#### Scenario: Command steps are short and end with a Core link

- **WHEN** the section of each of `create`, `provision`, `watch`, `down`, `deprovision` and `implode` in the built Overview page is read
- **THEN** it has at most 60 words before its last paragraph and contains no list, table or fenced code
- **AND** its last paragraph is `More details at` followed by a link whose text is the command and whose target is `/guide/core#<command>`, and a period

#### Scenario: The seed step keeps its explanation and example

- **WHEN** the section `seed` of the built Overview page is read
- **THEN** it contains fenced YAML that sets the `seed` step
- **AND** it links to the Configuration headings of `variant.steps` and `variant.seed`
- **AND** it has no `More details at` sentence

#### Scenario: Custom steps keep their examples

- **WHEN** the built Overview page is read
- **THEN** its Custom Steps and Custom multi-tenancy steps sections each contain fenced YAML
- **AND** the multi-tenancy section links to the Configuration headings of `db.multi`

#### Scenario: Core carries what the Overview drops

- **WHEN** the built Core page is read
- **THEN** its `provision` and `deprovision` sections link to the Configuration headings of `variant.steps` and `db.multi`
- **AND** its `watch` section names `--reprovision`

### Requirement: MCP tools have a heading each

The *Available tools* section of the MCP server page SHALL have one third-level heading per registered tool, named as the tool (`variant_init`), in the order of the commands. Each tool section SHALL link to the section of the same command in Core (`variant_init` to `/guide/core#init`), SHALL state only what differs from that command, and SHALL show a table of the parameters the tool takes. Arguments a tool fixes itself SHALL NOT be in the table.

#### Scenario: One heading per registered tool

- **WHEN** the third-level headings of *Available tools* in the built MCP page are listed
- **THEN** they equal `variant_<name>` for every registered command, in registration order

#### Scenario: Each tool links to Core and lists its parameters

- **WHEN** the section of a tool in the built MCP page is read
- **THEN** it links to the Core heading of the command of that name
- **AND** its table has one row per argument the tool takes
- **AND** the table has no row for an argument the tool fixes

### Requirement: Chat Renamer configuration page structure

The Chat Renamer configuration page SHALL be structured like the Configuration page: it SHALL open with an Options section, SHALL give every key of `chatRenamer` in the `variants.yaml` schema a third-level heading named `chatRenamer.<key>` and every sub-key a third-level heading named with its full path (`chatRenamer.awake.when`), in alphabetical order, and SHALL end with the editor settings that are not `variants.yaml` keys.

#### Scenario: Every chat renamer key has a heading

- **WHEN** the built Chat Renamer configuration page is read
- **THEN** each key and sub-key of `chatRenamer` in the `variants.yaml` schema has a third-level heading of its full path, for example `chatRenamer.trigger` and `chatRenamer.awake.graceDelaySecs`

#### Scenario: Chat renamer headings are alphabetical

- **WHEN** the `chatRenamer.` headings of the Options section are listed in page order
- **THEN** they equal the same list sorted alphabetically by full path

### Requirement: No earlier configuration shapes in the docs

The documentation SHALL NOT name configuration keys or shapes of earlier versions. Files that use them SHALL keep loading, without any mention in the docs.

#### Scenario: Docs omit the earlier names

- **WHEN** tracked files under `docs/` are searched
- **THEN** none contain `variant.instances`, `variant.reservedPorts` or `reservedPorts`
- **AND** none says that `{{...}}` templates, a list of `steps` or a `run` key without `cmd` still load

## MODIFIED Requirements

### Requirement: Runtime page

A top-level Runtime page SHALL document how watches behave: how `up` and `watch` prepare a variant, ports, state files, the interactive keys, exit statuses, the environment read through Mise, the variables a command sees or reads as overrides, and what is detected when `variant.watches` is omitted. The Configuration page SHALL NOT repeat those sections. The Runtime page SHALL have a second-level heading Watching with the third-level headings Interactive keys, Reattaching and Exit status below it, followed by a second-level heading Up that holds what is specific to `up`.

#### Scenario: Runtime holds the moved sections

- **WHEN** the built Runtime page is read
- **THEN** it has headings Runtime, Environment through Mise, Environment variables and When watches are omitted
- **AND** the built Configuration page has none of those headings

#### Scenario: Watching holds the attached-watch behavior

- **WHEN** the headings of the built Runtime page are listed in page order
- **THEN** Watching is a second-level heading and Interactive keys, Reattaching and Exit status are third-level headings directly below it
- **AND** Up is a second-level heading that follows the Exit status heading and precedes Environment through Mise

### Requirement: Configuration page structure

The Configuration page SHALL open with an Options section. The Options section SHALL give every key of `variant` in `variants.yaml` its own heading named `variant.<key>`, in alphabetical order, so other pages can link to it. Every sub-key of those options SHALL have a third-level heading of its own named with its full path (`variant.implode.maxDiffLines`, `variant.mise.binPath`, `variant.watches.<key>.dir`, `variant.steps.<name>.cmd`), directly after its parent and in alphabetical order. The Options section SHALL end with a `chatRenamer.*` entry that links to the Chat Renamer configuration page. A Database section SHALL follow it, with a third-level heading for every key of `db` and every key of `db.multi` (`db.ssl`, `db.multi.tenantsCmd`). The `variant.steps` section SHALL link to `overview#flow-of-steps`. Templates SHALL follow those sections and SHALL list every placeholder and environment form in a table. Unknown keys and migration SHALL be the last section and SHALL NOT name a key or shape of an earlier version.

#### Scenario: Every option has an anchor

- **WHEN** the built Configuration page is read
- **THEN** each key of `variant` in the `variants.yaml` schema has a heading `variant.<key>`, for example `variant.abbr` and `variant.baseBranch`

#### Scenario: Options are alphabetical

- **WHEN** the `variant.<key>` headings of the Options section are listed in page order
- **THEN** they equal the same list sorted alphabetically

#### Scenario: Every sub-key has a heading

- **WHEN** the third-level headings of the built Configuration page are read
- **THEN** every sub-key path of `variant` in the `variants.yaml` schema has one, where a key below `watches` is written `variant.watches.<key>.<option>` and a key below `steps` is `variant.steps.<name>.<option>`
- **AND** the headings for every key of `db`, for `db.multi.schemaPrefix`, `db.multi.tenants` and `db.multi.tenantsCmd` exist
- **AND** all headings starting with `variant.` are in alphabetical order by full path, and so are those starting with `db.`

#### Scenario: Section order

- **WHEN** the second-level headings of the Configuration page are listed
- **THEN** Options comes first, then Database, then Templates, and Unknown keys and migration comes last

#### Scenario: Options end with the chat renamer entry

- **WHEN** the Options section of the built Configuration page is read
- **THEN** its last heading is `chatRenamer.*`
- **AND** it links to `/chat-renamer/configuration`

#### Scenario: Steps link to the flow of steps

- **WHEN** the `variant.steps` section of the built Configuration page is read
- **THEN** it links to `/guide/overview#flow-of-steps`

#### Scenario: Templates are listed in a table

- **WHEN** the Templates section of the built Configuration page is read
- **THEN** it has a table with a row for each of `${slug}`, `${schema}`, `${storage}`, `${worktree}`, `${url}`, `${port}`, `${<watch>.port}`, `${abbr}`, `${multi.tenants}`, `${multi.schemaPrefix}`, `${NAME}`, `${NAME:-default}` and `$${`

### Requirement: Library page shows code

The library page SHALL consist of code examples with a one-line caption each, and SHALL link to Core for what a command does. Its configuration section SHALL be a list of deep links into the Configuration page and SHALL NOT repeat a sample `variants.yaml`.

#### Scenario: Library links into Core

- **WHEN** the built library page is read
- **THEN** it contains fenced code for `createVariantClient`
- **AND** it links to `/guide/core`

#### Scenario: Library configuration links to the options

- **WHEN** the configuration section of the built library page is read
- **THEN** it links to `/guide/configuration#variant-watches`, `/guide/configuration#variant-seed` and `/guide/configuration#variant-mise`
- **AND** it contains no fenced code
