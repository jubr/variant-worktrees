# Extension

The **Variant Worktrees** extension brings variants into VS Code and Cursor: a view of every variant, onboarding for a project that has none yet, the MCP server for your agents, and the chat renamer.
It is tested with Cursor and needs VS Code 1.101 or a host with Node.js 22.13 or newer.
How to install it is in [Installation](/guide/installation#vs-code-and-cursor-extension).

The extension runs the lifecycle in-process, the same code as the CLI.

## Onboarding

Without a `variants.yaml` the section of the Explorer says that variants are not initialized and offers **Onboard**.
A one-time notification points at that section too.

**Variant: Initialize in this Repo** (and **Onboard**) shows a dialog in place of the variants tree:

- three checkboxes: write `variants.yaml` with autodetected values, add `<prefix>*` to `.gitignore`, and augment `mise.toml` with the CLI.
  In a workspace that already has a `variants.yaml` the first one is off;
- a collapsed **Advanced** disclosure with the **Prefix** field (default `_v-`);
- **Cancel** and **Initialize**.

**Initialize** runs `variant init` inside the extension host, opens the written `variants.yaml` and confirms each step.
A step that fails keeps the dialog open with its message.
The steps are those of [`variant init`](/guide/commands#variant-init).

After a local commit in a workspace without `variants.yaml`, where a database and an application (Vite, NestJS or a package with a `watch` script) are detected, a notification such as `Detected postgres+vite, want to bootstrap Variant in this repo?` offers **Bootstrap Variant** once per workspace.

When `variants.yaml` uses names of an earlier version, the extension rewrites it and shows a warning with the actions **Open file** and **Undo**; see [Unknown keys and migration](/guide/configuration#unknown-keys-and-migration).

## Variants view

A **Variant Worktrees** section in the Explorer lists every variant of the first workspace folder.
The same rows are an activity-bar tree. The section starts collapsed.
When the workspace already uses variants or looks ready for them, and `variant.autoExpand` is not `false`, it expands and the editor keeps focus.
A focused file inside the main checkout or a variant worktree highlights its row, without taking editor focus.
The view follows changes made by the CLI, an agent over MCP or another window within seconds.
`main` stays pinned first, under the UI server item.

**Variant: Open Variants Panel** shows the same list, in the same order, in an editor panel.
**Variant: Open Variants in Browser** opens the web page served by `variant ui`; without a running server it names `variant ui --detach`.

### Rows

Each row shows a state icon (a hollow dot when down, a filled green dot when watching, a different shape when up), the uptime, and a tooltip with its state, mode, URL, worktree and whether `implode` would succeed.
A variant that exists only in the database has a small `d` after the slug.

| Control | What it does |
| --- | --- |
| Play | **variant watch**, detached, when the variant is down. The row shows a loading icon until every watch with a URL and a `ready` path has a live pid and answers 200 |
| Stop | brings a watching or up variant down |
| Open url | opens the URL of the row in the external browser, or in a Cursor browser tab while Alt is held. The browser opens once, when the last watch answers 200 |
| Explosion | `implode`, on every row except `main`, after a confirmation. It is muted when `implode` would fail: activating it writes the colored implode report to the extension output and asks whether to pass `--force` |
| Create variant | sits left of Sort; creates a variant |
| Sort | `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)` or `Changed (new→old)`; the setting is `variant.sort` |

A failed watch, down or implode shows that error in a notification and in the extension log.
The context menu shows the watch output (`.cache/variant/watch.log`), opens the URL, the panel and the web page.
What a watch does while it starts is in [Runtime](/guide/runtime#starting), and the keys, reattaching and exit status of an attached watch are under [Watching](/guide/runtime#watching).

## Environment and Mise

The environment comes from Mise.
When Mise fails, a notification names the directory and Mise's message, and for an untrusted configuration offers **Trust**, which runs `mise -C <dir> trust --all` and repeats the action.
The setting [`variant.mise.binPath`](/guide/configuration#variant-mise-binpath) names the Mise executable when it is not on the `PATH` of the editor; a change applies without a reload.
The lookup order is in [Runtime](/guide/runtime#environment-through-mise), and the matching key of `variants.yaml` is [`variant.mise`](/guide/configuration#variant-mise).

## MCP server

The extension registers the `variant` MCP server for the open workspace in Cursor and VS Code, so an agent can create, watch and implode variants itself.
The tools and the client configuration for other editors are in [MCP Server](./mcp).

## Chat renamer

The extension embeds the full [Chat Renamer Extension](/chat-renamer/) functionality: it names a Cursor chat after the variant it works on, from the first prompt (`/chat-rename my-title`, `/vw-spec-start my-slug`, or a dragged worktree folder), numbers chats of the same name, and keeps the host awake while chats are active.
See [configuration](/chat-renamer/configuration).

## Palette Commands

Open the palette with `Cmd+Shift+P` (`Ctrl+Shift+P`).
The commands marked *needs a folder* appear only when a workspace folder is open.
The row actions of the Variants view (play, stop, open url, show output, implode) act on one variant and are not in the palette.

- **Variant: Initialize in this Repo** (needs a folder): Shows the [onboarding](#onboarding) dialog that runs [`variant init`](/guide/commands#variant-init).
- **Variant: Open Variants Panel** (needs a folder): Shows the list of variants in an editor panel, in the same order as the view.
- **Variant: Open Variants in Browser** (needs a folder): Opens the web page of `variant ui` in the browser, and names `variant ui --detach` when no server runs.
- **Variant: Rename active chat**: Renames the active Cursor chat from its first prompt.
- **Variant: Rename Existing Chats**: Renames the chats of the last seven days again, ignoring which ones were examined before.
- **Create variant** (needs a folder): Asks for a slug in an input box, then runs [`variant create`](/guide/commands#variant-create) for it and refreshes the view.
  The schema is not created; that is `provision`.
