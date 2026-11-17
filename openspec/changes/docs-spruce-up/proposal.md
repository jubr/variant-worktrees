## Why

The documentation is organised around the packages (CLI, library, MCP), not around what a reader wants: add Variant Worktrees to an existing project. Installation lists `npm install` commands for packages that are not published on npm. Runtime behavior of watches is buried inside the Configuration page, which also mixes options, migration notes and templating in an order that is hard to scan and impossible to link into (`variant.abbr` has no heading).

## What Changes

- **Installation** (`docs/guide/installation.md`) is about installing into your existing project, in two flavors:
  - mise-cli first: install mise (brew or `mise.run`), then in your own project `mise x github:jubr/variant-worktrees@latest -- variant init`, and what `init` does.
  - vscode-first ("tested with Cursor"): install the **Variant Worktrees** extension, then follow its **Onboarding**.
  - A link to Development ("the other type of installation": from source). TypeScript library and MCP server installation move to Development.
  - No `npm install`, `npm install -g`, `npx` or `bun add` command remains under `docs/`; the packages are not on npm.
- **Library** (`docs/guide/library.md`) keeps code examples only; behavior prose is replaced by links into Core.
- **VSCode / Cursor** is a new sidebar group below Variant Worktrees, holding Extension, MCP Server and Socket IPC (moved out of the Variant Worktrees group).
- **Socket IPC**: `docs/guide/ipc.md` is renamed `docs/guide/socket-ipc.md`, titled "Socket IPC"; inbound links follow.
- **Extension** is a new guide page that details the behavior of `variant-vscode` (Variants view, panel, onboarding, MCP registration, chat renamer hook-up). It is the first page of that group, above the MCP server and the Socket IPC page.
- **Cross-links**: Getting Started, Installation, Core, Configuration, Runtime and Library link to the pages of the VSCode / Cursor group where they mention the editor, the MCP server or the socket; the group's pages link back to Installation, Runtime and Configuration.
- **Runtime** becomes a top-level guide page after Installation, tailored to watches and how they behave. It takes over from Configuration: *Runtime*, *Environment through Mise*, *Environment variables* and *When watches are omitted*.
- **Configuration** is reordered: *Options* first, one heading per option, alphabetical, each option anchored by its own heading (`variant.abbr`, `variant.baseBranch`, ...) so other pages can link to it. *Templates* and then *Unknown keys and migration* come last.
- **Relocatable site**: upgrade `vitepress` from `^1.6.4` (no relative base) to the 2.0 alpha line, pinned exactly (`2.0.0-alpha.21` at the time of writing), and set `base: './'`, so every stylesheet, script, favicon, logo and page URL is relative to its page instead of starting with `/variant-worktrees/`. The `withPagesBase` rewrite of `head` entries goes; favicon links become relative per page with `transformHead`. `cleanUrls` stays off. The GitHub Pages deployment keeps working from the same build.
- **Outline**: the right-hand "On this page" outline lists second- and third-level headings, so the per-option headings of Configuration show up in it.
- A docs spec test (QA) pins the option headings: one `variant.<key>` heading per key of the `variant` schema and the headings are in alphabetical order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `docs/site`: removes *Published asset URLs* (the `/variant-worktrees/` prefix) and adds *Relocatable asset URLs*; modifies *Sidebar groups* and *Dark document shell* (the outline lists `h2` and `h3`); adds requirements for the installation page, the runtime page, the extension page, the cross-links into the VSCode / Cursor group, the library page and the configuration page structure.

## Impact

- `docs/guide/installation.md`, `library.md`, `configuration.md`, `index.md`, `ipc.md`, `development/building.md`, new `docs/guide/runtime.md` and `docs/guide/extension.md`, `docs/.vitepress/config.ts` (sidebar).
- Inbound links to moved headings (`#environment-through-mise`, `#when-watches-are-omitted`, `#runtime`, `#options`, `#templates`) in `docs/`, `README.md` and `packages/*/README.md`.
- `package.json`, `bun.lock` (`vitepress`).
- `scripts/docs-site.spec.ts` (sidebar order, built pages, the two published asset URL tests) and a new spec test for the option headings.
- `CHANGELOG.md`.

## Assumptions

- "Runtime to toplevel section" means a top-level sidebar page, not an `##` heading in the Configuration page (it already is one).
- Sidebar order: Getting Started; Variant Worktrees (Core, Configuration, Installation, Runtime, Library); VSCode / Cursor (Extension, MCP Server, Socket IPC); Chat Renamer; Development. The socket page is renamed: `docs/guide/ipc.md` becomes `docs/guide/socket-ipc.md` (URL `/guide/socket-ipc`) with the title and sidebar label "Socket IPC".
- "Options" are all keys of `variant` in `variants.yaml.schema.json`; `variant.watches` and `variant.seed` get headings too, so the QA test needs no exceptions. The `db` and `chatRenamer` sections keep their own places below.
- The MCP server page `docs/mcp.md` keeps its client setup; only its installation moves to Development.

## Non-goals

- No change to the deployment workflow (`docs.yml` keeps building and uploading `docs/.vitepress/dist`), and no `cleanUrls` or arbitrary-depth `404.html` support.
- No change to CLI, library, extension or MCP behavior, and no new config keys.
- No change to `README.md` files, `docs/guide/core.md` or `docs/guide/overview.md` beyond fixing links.
