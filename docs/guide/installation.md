# Installation

Variant Worktrees goes into the project you already have.
Both ways in step 2 end the same: a `variants.yaml` in your repository that says what a variant runs.
They work side by side.

## 1. Install mise

[mise](https://mise.jdx.dev) installs the tools a project asks for and puts them on your `PATH` when you enter that directory.
Install it with Homebrew or with the installer script:

```bash
brew install mise
# or
curl https://mise.run | sh
```

Then activate mise in your shell, once, so the tools of a project are on your `PATH` whenever you are in it.
`mise activate` prints the code for your shell, which you put in its startup file:

```bash
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc  # or bash, fish, ...
```

Without activation, `mise x --` runs a single command with the tools of the project, as in step 2b.

## 2a. Extension for VSCode and Cursor

Tested with Cursor.

1. Install the **Variant Worktrees** extension from the Extensions view of your editor (search for `Variant Worktrees`), or from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jubr.variant-worktrees) or [Open VSX](https://open-vsx.org/extension/jubr/variant-worktrees).
2. Open your project. A **Variant Worktrees** section appears in the Explorer.
3. Follow its **Onboarding**: when the project has no `variants.yaml`, the section offers **Onboard**.
   It opens the same dialog as **Variant: Initialize in this Repo**, and confirming it with **Initialize** runs [`variant init`](./commands#variant-init) in your main checkout.

The extension can run the init logic, so step 2b is not needed after it.
Afterwards the section lists your variants, and you can create, watch and implode them from there.
[Extension](/vscode/extension) describes everything it does, including registering the [MCP Server](/vscode/mcp) for your agents.

## 2b. Install with `variant init`

In your own project, run `variant init` through mise.
`mise x` fetches the latest release of `variant` into the cache of mise and runs it once:

```text
$ cd path/to/my-project
my-project/ $ mise x packslip:jubr/variant-worktrees@ -- variant init
Initialized /path/to/my-project
variants.yaml:  written to /path/to/my-project/variants.yaml
.gitignore:     created .gitignore with _v-*
mise:           created mise.toml with github:jubr/variant-worktrees
detected:       database postgres; abbr mp; watches none
bun:            bun 1.4.4 on PATH is the version Mise pins
```

What `init` writes, why, and which flags turn a part off is in [`variant init`](./commands#variant-init).
Run `mise install` in the project, and `variant` is on your `PATH` whenever you are in it.

## 3. Review `variants.yaml`

`init` wrote `variants.yaml` from what it detected.
Review it with `git diff`, adjust it, and commit it.
A password is never written: it is a `${NAME}` reference, and the comment says where the value was found.

```yaml
# Written by `variant init` from what autodetection found. Other accepted values follow `#` on the same line.

db:
  dialect: postgres # sqlite | mysql
  host: ${POSTGRES_HOST} # from mise.local.toml
  port: ${POSTGRES_PORT} # from mise.local.toml
  user: ${POSTGRES_USER} # from mise.local.toml
  password: ${POSTGRES_PASSWORD} # from mise.local.toml
  database: my_project
variant:
  abbr: mp # lowercase letters and digits, single hyphens between
  prefix: _v- # starts every name derived from a slug; keep the connector
```

Every key is explained in [Configuration](./configuration#variant-options).
