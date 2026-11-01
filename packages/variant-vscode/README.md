# Variant Worktrees

![Variant Worktrees](media/icon-256.png)

**Isolated worktree+db for agents+yourself :: watches, seed, implode :: cli, mcp & vscode**

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
  up: npm run db:migrate
  watch: npm run dev
  seed: npm run db:seed
  instances:
    fe:
      kind: vite
      dir: fe
      open: http://{{slug}}.vw.localhost:{{port}}
    be:
      kind: nestjs
      dir: be
```

Vite and NestJS apps are detected automatically, so a small project may need no instances at all. Database settings are read from `mise.local.toml`, then from environment variables. Every option, including templates, steps, and the `implode` safety rules, is in the [configuration guide](https://jubr.github.io/variant-worktrees/guide/configuration).

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

The tools are `variant_config`, `variant_list`, `variant_create`, `variant_switch`, `variant_provision`, `variant_up`, `variant_down`, `variant_watch`, and `variant_implode`. See the [MCP guide](https://jubr.github.io/variant-worktrees/mcp).

## See your variants

A **Variants** view in the Explorer lists every variant of the first workspace folder, `main` first. Each item has a watching, up or down icon, the uptime as description and a tooltip with its state, mode, URL and worktree.

- Inline: **play** starts a detached `watch`, **stop** brings the variant down, **implode** removes it after a confirmation in a modal dialog. While an action runs the item shows a progress icon.
- Context menu: show the watch output (the `variants.watch.log` file), open the URL, open the panel, open the web page.
- A `UI server` item above the variants appears while `variant ui` runs, with open and stop actions.
- Without a `variants.yaml` the view says so; without variants it names `variant create`.

**Variant: Open Variants Panel** opens the same app in an editor panel. **Variant: Open Variants in Browser** opens the page of a running `variant ui` server with its token; start one with `variant ui --detach`.

The view and the panel call `variant-api` inside the extension host. The extension socket does not carry these actions. Requires VS Code 1.101 or a host with Node.js 22.13 or newer.

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
