# Installation

Variant Worktrees goes into the project you already have.
Both ways below end the same: a `variants.yaml` in your repository that says what a variant runs.
Install the editor extension, or the CLI through mise; they work side by side.

## VS Code and Cursor extension

Tested with Cursor.

1. Install the **Variant Worktrees** extension from the Extensions view of your editor (search for `Variant Worktrees`), or from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jubr.variant-worktrees) or [Open VSX](https://open-vsx.org/extension/jubr/variant-worktrees).
2. Open your project. A **Variant Worktrees** section appears in the Explorer.
3. Follow its **Onboarding**: when the project has no `variants.yaml`, the section says that variants are not initialized and offers **Onboard**.
   It opens the same initialization dialog as **Variant: Initialize in this Repo**; confirm with **Initialize**, and the three steps of `init` described [below](#mise-cli) run in your main checkout.

After onboarding the section lists your variants, and you can create, watch and implode them from there.
[Extension](/vscode/extension) describes everything it does, including registering the [MCP Server](/vscode/mcp) for your agents.

## mise CLI

[mise](https://mise.jdx.dev) installs the tools a project asks for and puts them on your `PATH` when you enter that directory.
Install mise first, with Homebrew or with the installer script:

```bash
brew install mise
# or
curl https://mise.run | sh
```

Then, in your own project:

```bash
cd path/to/your/project
mise x github:jubr/variant-worktrees@latest -- variant init
```

`mise x` fetches the latest release of `variant` from GitHub into mise's cache and runs `variant init` with it.
`init` looks at your project and does up to three things, each of which you can turn off:

- **writes `variants.yaml`** from what it detects: the database (Postgres, MySQL, MariaDB or SQLite) from `mise.local.toml` or the environment, a short project label, and one watch for every Vite or NestJS app.
  A password becomes a `${NAME}` reference and is never written.
- **adds `_v-*` to `.gitignore`**, so the worktrees of your variants stay out of git.
- **adds `github:jubr/variant-worktrees` to your mise configuration** (`mise.toml` is created when there is none).
  Nothing is installed by that edit; run `mise install` and `variant` is on your `PATH` whenever you are in the project.

Review the result with `git diff`, adjust `variants.yaml` (see [Configuration](./configuration#variant-options)), and commit it.
The flags of `init`, such as `--prefix` and the `--file=false`, `--gitignore=false` and `--mise=false` switches, are in [`variant init`](./commands#variant-init).
