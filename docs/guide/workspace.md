# Workspace

Variant Worktrees works on any layout that git allows.
This page describes the layout it is built around, and why each part is where it is.

## The layout

The root directory is something short, here `vw`.
It is not a git repository, but it is the IDE workspace root.
It makes a lot of sense if this aligns with [variant.abbr](./configuration#variant-abbr).
It holds the primary checkout on `main`, one worktree per variant next to it, and the files that every checkout shares.

```text
vw/                                      # open this folder in the editor
├── .agents -> variant-worktrees/.agents             # symlink: skills and rules for agents
├── .vscode -> variant-worktrees/.vscode             # symlink: editor settings and the socket
├── AGENTS.md -> variant-worktrees/AGENTS.md         # symlink: the instructions every agent reads
├── CONTRIBUTING.md -> variant-worktrees/CONTRIBUTING.md   # symlink: how to change the code
├── .cursorindexingignore                # names _ref/** so the index skips it
├── mise.local.toml                      # database settings and tools, not in git
├── _ref/                                # other people's code, read only
│   ├── some-library/
│   └── design-sketch.png
├── variant-worktrees/                   # the primary checkout, branch main
│   ├── .git/                            # the one real git directory
│   ├── .agents/
│   ├── .vscode/
│   ├── AGENTS.md
│   ├── CONTRIBUTING.md
│   ├── mise.toml
│   ├── variants.yaml
│   └── packages/ ...
├── _v-feature-one/                      # variant: a worktree on its own branch
│   ├── .git                             # a file that points into ../variant-worktrees/.git
│   ├── .cache/variant/
│   │   ├── state.yaml                   # ports, pids, URLs
│   │   └── watch.log
│   └── packages/ ...
└── _v-feature-42/                       # another variant, with its own schema and ports
    └── ...
```

The three symlinks are the ones to get right: `AGENTS.md`, `CONTRIBUTING.md` and `.agents`.
`.vscode` is a symlink for the same reason.

## Why it looks like this

**The variants are siblings of the primary checkout, not inside it.**
A worktree is a complete checkout.
Inside the primary checkout it would be a second copy of every file in the one tree that git, the editor search, the test runner and the bundler scan.
Next to it, each checkout is a plain folder that tools handle on its own, and the primary checkout stays clean without ignore rules for its own children.
Every variant is one `cd ../_v-<slug>` away from any other.
[`variant.root`](./configuration#variant-root) is the directory that holds them, and `variant create` puts a new worktree there.

**The primary checkout stays on** `main`**.**
It is the place for the files that belong to the project, and the anchor of the layout: the worktrees, the state and the database schemas all refer back to it.
A variant is where the work happens, and it ends with `implode`, which removes the worktree and the branch once the work is merged.
Nothing you want to keep lives in a variant.

**The** `_v-` **prefix groups the variants.**
[`variant.prefix`](./configuration#variant-prefix) defaults to `_v-`.
It sorts them together in a file listing, it separates them from the real directories, and one glob, `_v-*`, matches all of them.
A worktree that is placed inside the primary checkout gets the prefix added to `.gitignore`.
Next to it, no ignore rule is needed.

`AGENTS.md`**,** `CONTRIBUTING.md` **and** `.agents` **are symlinks into the primary checkout.**
There is one copy, tracked in git on `main`, and it is the one you review.
An agent that starts at `vw`, at the primary checkout or in a variant finds the same instructions, skills and rules, so a rule written once applies to every variant.
A variant carries its own committed copy of these files, because it is a checkout of the same repository.
The symlinks at the root are what keep the instructions available at the level above the checkouts.
[`variant.main`](./configuration#variant-main) is found through the `AGENTS.md` symlink: it names the checkout that the link points into.
That is why the symlink is a part of the layout and not a convenience.

`.vscode` **is a symlink for the editor socket.**
The extension hosts one Unix socket for the whole workspace, in the `.vscode` of the primary checkout.
The CLI in a variant finds the editor through it.
The details are in [Socket IPC](/vscode/socket-ipc#linked-checkout).

`mise.local.toml` **sits at the root, not in git.**
Mise reads it from every checkout below it, so the primary checkout and every variant get the same database host, user and password.
Each variant gets its own schema on that server. The credentials are in no repository.
A project file such as `mise.toml` pins the tools and is committed.
The settings that [`variants.yaml`](./configuration) reads come from here first, then from the environment.

`_ref` **holds code to read, not to change.**
It is a place for another project's source, an API sample or a design sketch that an agent should be able to open.
It is not a checkout of yours, so it is not a variant, and it is not in git.
`.cursorindexingignore` names `_ref/**`, so the editor's index and its search skip it and its files do not drown out yours.
An agent can still open a file there when you point at it with `@`.
The leading underscore sorts it with the variants and apart from the checkout.

```text
# .cursorindexingignore
_ref/**
```

**The root is the folder the editor opens.**
One window sees the primary checkout and every variant.
The Variants view lists them, the agents work in one each, and a chat is named after the variant it works in (see [Chat Renamer Extension](/chat-renamer/)).

## Starting from this layout

Create the root folder, clone the project into it, and add the symlinks and the Mise file:

```bash
mkdir vw && cd vw
git clone <repository> variant-worktrees
ln -s variant-worktrees/AGENTS.md AGENTS.md
ln -s variant-worktrees/CONTRIBUTING.md CONTRIBUTING.md
ln -s variant-worktrees/.agents .agents
ln -s variant-worktrees/.vscode .vscode
cd variant-worktrees
variant init
variant create -s feature-one
```

[`variant init`](./commands#init) writes `variants.yaml`, adds the prefix to `.gitignore` and adds the CLI to the Mise configuration.
`variant create` then adds `_v-feature-one` beside the checkout.
