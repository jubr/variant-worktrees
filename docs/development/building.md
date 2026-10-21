# Building

Build from a checkout of this repository. In another project, install the CLI with mise instead: see [Getting Started](/guide/).

## Requirements

- [Bun](https://bun.sh/)
- [mise](https://mise.jdx.dev/)

## From source

```bash
git clone https://github.com/jubr/variant-worktrees.git
cd variant-worktrees
mise x -- task bootstrap
mise x -- task build
```

`task bootstrap` trusts the checkout, installs the pinned tools, and installs workspace dependencies. `task build` builds `variant-config`, `variant-api`, and `variant-mcp`.

```bash
mise x -- task lint
mise x -- task test
```
