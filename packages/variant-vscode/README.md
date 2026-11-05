# Variant Worktrees

**Isolated work+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode**

📖 **[Read the documentation](https://jubr.github.io/variant-worktrees/)**

## Why

Three agents, one repository, one database. Each agent wants its own branch, its own dev servers, and its own data. Git worktrees give every agent its own checkout, but the database stays shared: one agent's migration breaks the others, a seed script wipes your test data, and two dev servers fight over port 3000.

A **variant** closes that gap. It is a git worktree that comes with its own database schema (PostgreSQL, MySQL, or a SQLite file), its own storage directory, and its own free ports. You get a place where an agent, or you, can change anything without touching anyone else's work. When the work is merged, the variant disappears completely.

## How it works

You describe your project once in `variants.yaml`. Then three commands cover the whole life of a variant:

```bash
variant watch -s feature-forty-two     # create the worktree and database, seed it, start the dev servers
# ... work, browse, commit ...
variant implode -s feature-forty-two   # stop everything, drop the database, remove the worktree
```

- **`create`** makes the `_v-feature-forty-two` worktree on its own branch.
- **`watch`** provisions it (install, migrate, seed) and keeps your dev servers running on free ports, so you can follow an agent's progress live in the browser.
- **`up`** does the same with containers instead of host processes. **`down`** stops either one and keeps the data.
- **`implode`** stops the variant, drops its database and storage, and removes the worktree. It refuses to run on `main` and on work that is not merged into your base branch, unless you pass `--force`. The branch itself stays.

When you work inside a variant worktree yourself, the slug comes from the branch, so you can leave out `-s`.

Install the `variant` CLI into a project with [mise](https://mise.jdx.dev):

```bash
mise use github:jubr/variant-worktrees
```

## Describe your project once

```yaml
variant:
  seed: npm run db:seed
  watches:
    fe:
      kind: vite
      dir: fe
      watch: npm run dev
      url: http://${slug}.vw.localhost:${port}
    be:
      kind: nestjs
      dir: be
      up: npm run db:migrate
      watch: npm run start:dev
```

Vite and NestJS apps are detected automatically, so a small project may need no watches at all. Database settings are read from the environment (as `mise env` prints it), then explicit `db` values override them. `variant init` writes a first `variants.yaml` from what it detects. Every option, including templates, steps, and the `implode` safety rules, is in the [configuration guide](https://jubr.github.io/variant-worktrees/guide/configuration).

A configuration that still uses `instances` (now `watches`) or `reservedPorts` (now `ports.range`) loads as before. When `variants.yaml` is tracked by git without uncommitted changes (or untracked, with the old text saved as `variants.yaml~`), the extension rewrites it and shows a warning with the actions **Open file** and **Undo**; the change is a plain `git diff`, or the backup. `VARIANT_MIGRATE=0` turns the rewrite off.

## Let your agents drive

The same operations are available as an MCP server, so Cursor, Claude, or any MCP client can create, watch, and implode variants itself:

```json
{
  "mcpServers": {
    "variant": {
      "command": "variant-mcp",
      "args": ["--config", "/workspace/variants.yaml"]
    }
  }
}
```

The tools are `variant_init`, `variant_config`, `variant_list`, `variant_create`, `variant_switch`, `variant_provision`, `variant_up`, `variant_down`, `variant_watch`, and `variant_implode`. See the [MCP guide](https://jubr.github.io/variant-worktrees/mcp).

## See your variants

A **Variant Worktrees** section in the Explorer lists every variant of the first workspace folder. It starts collapsed. The same rows are an activity-bar **Variant Worktrees** tree, whose icon is `variant-worktrees-view-icon.svg`. When the workspace already uses variants or looks ready for them, and `variant.autoExpand` is not `false`, the section expands and focus returns to the editor. Without a config file the section says variants are not initialized and offers **Onboard**. `main` stays pinned first, above the other variants and under the UI server item.

**Create variant** sits immediately left of **Sort**, which is immediately left of Open Variants Panel. Sort labels are `Name (A→Z)`, `Name (Z→A)`, `Created (old→new)`, `Created (new→old)`, `Changed (old→new)`, and `Changed (new→old)`. The same choice is the setting `variant.sort` (default `name-asc`). Created order uses `runtime.createdAt` (`YYYY-MM-DD_HH:MM:SS`), read as local time, or the directory creation time when that stamp is missing. Changed is the later modification time of the variant directory and `variants.local.yaml`. A missing time sorts as older.

Each item has a state icon (a hollow dot when down, a filled green dot when watching, a different shape when up), the uptime as description and a tooltip with its state, mode, URL, worktree and whether implode would succeed. A variant that exists only in the database has a space and a superscript d after the slug (a superscript 2 when that glyph cannot be shown).

- Inline: when the row has a URL, **Open url** sits immediately left of the run control, with the same external-link icon as **Open Variants in Browser**. A click opens that URL in the external browser (tooltip `Open url in external browser`). While Alt is held the tooltip is `Open url in Cursor browser` and the click opens a Cursor browser tab. The play icon is **variant watch** and starts a detached `watch` when the variant is down. A square **Stop** brings a watching or up variant down. The explosion control sits at the right of every row except `main` and removes the variant after a confirmation. It is muted when implode would fail. Activating the muted explosion asks whether to pass `--force`, with **Cancel** and **Force**. **Force** implodes with `--force` and does not open the clean confirmation. A failed watch, down, or implode shows that error in a notification, and the extension log records it. While an action runs the item shows a progress icon.
- Context menu: show the watch output (the `variants.watch.log` file), open the URL, open the panel, open the web page.
- A `UI server` item above the variants appears while `variant ui` runs, with open and stop actions.

**Variant: Open Variants Panel** opens the same app in an editor panel and follows `variant.sort`. **Variant: Open Variants in Browser** opens the page of a running `variant ui` server with its token; start one with `variant ui --detach`. That page stays in name order.

The view and the panel call `variant-api` inside the extension host. The extension socket does not carry these actions. Requires VS Code 1.101 or a host with Node.js 22.13 or newer.

## Set up a project

**Variant: Initialize in this Repo** shows a dialog in place of the variants tree: three checkboxes (write `variants.yaml` with autodetected values, add `<prefix>*` to `.gitignore`, augment `mise.toml` with variant-cli), a collapsed **Advanced** disclosure with the `Prefix` field (default `_v-`), and `Cancel` and **Initialize**. **Initialize** runs `variant init` inside the extension host, opens the written `variants.yaml` and confirms each step; a step that fails keeps the dialog open with its message. An empty prefix or one with a path separator disables **Initialize** and shows the reason even while **Advanced** is collapsed. In a workspace that already has a `variants.yaml` the first checkbox is off. **Onboard** in the section opens the same dialog.

After a local commit in a workspace without `variants.yaml` where a database and an application (Vite, NestJS or a package with a `watch` script) are detected, a notification such as `Detected postgres+vite, want to bootstrap Variant in this repo?` offers `Bootstrap Variant` once per workspace.

The environment comes from Mise. When Mise fails, a notification names the directory and Mise's message, and for an untrusted configuration offers **Trust**, which runs `mise -C <dir> trust --all` and repeats the action. `variant.mise.binPath` names the Mise executable when it is not on the `PATH` of the editor; a change applies without a reload.

## One chat per variant

Every agent chat deserves a name that says which variant it works on. This extension renames a Cursor chat from its first prompt:

- `/chat-rename my-title` sets that title.
- `/vw-spec-start my-slug` becomes `my-slug`, using the activation patterns in your settings.
- A worktree folder dragged into the chat, such as `_v-my-slug`, becomes `my-slug`.
- Chats with the same name are numbered: `my-slug`, `my-slug2`, `my-slug3`.

It also renames the chats you already have from the last seven days. The palette commands are **Variant: Rename active chat** and **Variant: Rename Existing Chats**. Options live in the `chatRenamer` section of `variants.yaml` or in the `variant.*` editor settings; see the [chat renamer guide](https://jubr.github.io/variant-worktrees/chat-renamer/). Renaming is experimental, since it relies on Cursor internals that can change in any release.

## Learn more

- [Getting started](https://jubr.github.io/variant-worktrees/guide/)
- [Every `variant` command](https://jubr.github.io/variant-worktrees/guide/core)
- [Configuration](https://jubr.github.io/variant-worktrees/guide/configuration)
- [MCP server](https://jubr.github.io/variant-worktrees/mcp)
- [Chat renamer](https://jubr.github.io/variant-worktrees/chat-renamer/)
- [Source and issues](https://github.com/jubr/variant-worktrees)

MIT licensed.
