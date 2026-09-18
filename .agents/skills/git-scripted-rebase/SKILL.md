---
name: git-scripted-rebase
description: >
  Split, reorder, combine, or drop commits via a scripted interactive rebase
  using git-rebase.sequence.txt. Use when the user asks to rewrite branch
  history, squash WIP, drop a commit (including secrets), split a branch, or
  invoke /git-scripted-rebase.
---

# git scripted rebase

## Tools

- If not in `mise hook-env`: Always `mise x -- …` for `openspec`, `task`, `bun`, and other project tools.
  This applies to all command invocations in this file. Also note `mise` manages env vars for child processes.

Use when you want to split-off, reorder, combine or remove commits from a branch.
Usecases:
- remove accidentally committed secrets
- split large branch into a few smaller ones
- combine a few (wip) commits into one logical

## Prerequisites

Mentioned in the prompt or from context:
- {git_workdir} = can be a git worktree
- {commit} = the commit you want to rebase from, best specified as `HEAD~n`
- {goals} = clear statement of what needs to be achieved, so we can `5. Verify` at end
Abort if one is not 100% clear

Use the commands below VERBATIM: they are carefully crafted to use this advanced technique.
You can only change the commit-ish in the commands.

Realization: git calls `sh -c "$GIT_SEQUENCE_EDITOR /tmp/sequence.txt"` and waits for it to exit.
We will use it in 2 modes:
- extract: get out the sequence & ensure it does nothing
- execute: inject "our" modified sequence & execute

## Steps

Print each step as H3 in the chat.
MUST any explicit questions to the user should be presented with Cursor's interactive Multiple-choice Question UI in the chat waiting indefinetely!


### 1. Prepare

Find out where we are:
- {branch} = `git branch --show-current`
- `git log --graph --oneline --decorate -nXX` dense view of things
- `git status`
Print these to the chat.

If git working copy not clean, ask:
    1. Run `git stash save "{branch}-pre-rebase"`?
    2. Leave it, continue and hope for the best

Store branch pointer to original commit: `git branch -f "{branch}-pre-rebase" HEAD`

### 2. Extract git-rebase.sequence.txt

```sh
cd {git_workdir} && \
GIT_SEQUENCE_EDITOR='f() { set -x; mv "$1" git-rebase.sequence.txt; grep -v "^#" git-rebase.sequence.txt; echo "# Safely ignore expected nothing-to-do error:" > "$1"; }; f' \
git rebase -i {commit}
```

To find out how to achieve {goals}:
- Make sure {commit} and other {goals} are reachable with `HEAD~n`
- Might need to `git show d34db33f --stat` (or non-stat) a few to see what they do
- Relative ordering of commits should remain intact if they touch the same files. if not → possible conflict
- Beware order in `git-rebase.sequence.txt` is inverse of `git log`
- When combining commits: use `squash`, `fixup` or `fixup -C` to use that commit msg

### 3. Modify git-rebase.sequence.txt

- modify `git-rebase.sequence.txt` to achieve {goals}

MUST stop here and ask how to continue:
    1. Continue with script for `git rebase -i {commit}`
    2. Abort + do nothing
    3. Abort + remove `-pre-rebase` + `stash pop`

### 4. Execute git-rebase.sequence.txt

```sh
cd {git_workdir} && \
GIT_SEQUENCE_EDITOR='echo ""; set -x; cp git-rebase.sequence.txt' \
git rebase -i {commit}
```

When running into conflicts:
1. Read + fix affected files
2. `git add {file}`
3. Use `git show REBASE_HEAD` when needed
4. `GIT_EDITOR=true git rebase --continue`, or:
   - `GIT_EDITOR='f() { set -x; mv "$1" git-rebase.msg.txt; grep -v "^#" git-rebase.msg.txt; echo "# Safely ignore expected nothing-to-do error:" > "$1"; }; f' git rebase --continue`
   - modify `git-rebase.msg.txt` if necessary
   - `GIT_EDITOR='echo ""; set -x; cp git-rebase.msg.txt' git rebase --continue`
5. When unsure how to resolve: ask

### 5. Verify

- show `git log --graph --oneline --decorate -nXX [--all]`
- validate {goals} are achieved in chat
- check `git status`

### 6. Pop

Ask which to clean up:
    1. Delete `git-rebase.*.txt` (cursor native file delete)
    2. `git stash pop "{branch}-pre-rebase"` (if saved before, else omit)
    3. `bit branch -D "{branch}-pre-rebase"`
    4. All of the above
    5. None
    6. Undo: `git reset --hard "{branch}-pre-rebase"` & all above


## Example git-rebase.sequence.txt

```
drop 2cfbbfbd # fix(mwl): wrap InkWell in Material for proper ink effects
pick e1ee43db # test(bdd): improve weight goal test flow and reliability
pick 58e6189e # test(api-muck): add consent document endpoint pin
pick 237afad4 # build(taskfile): improve Android muck-free check and update DTT spec
fixup 7a7ce044 # fix DTT spec

# Rebase 9fb7f1b0..7a7ce044 onto 9fb7f1b0 (5 commands)
#
# Commands:
# p, pick <commit> = use commit
# r, reword <commit> = use commit, but edit the commit message
# e, edit <commit> = use commit, but stop for amending
# s, squash <commit> = use commit, but meld into previous commit
# f, fixup [-C | -c] <commit> = like "squash" but keep only the previous
#                    commit's log message, unless -C is used, in which case
#                    keep only this commit's message; -c is same as -C but
#                    opens the editor
# x, exec <command> = run command (the rest of the line) using shell
# b, break = stop here (continue rebase later with 'git rebase --continue')
# d, drop <commit> = remove commit
# l, label <label> = label current HEAD with a name
# t, reset <label> = reset HEAD to a label
# m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]
#         create a merge commit using the original merge commit's
#         message (or the oneline, if no original merge commit was
#         specified); use -c <commit> to reword the commit message
# u, update-ref <ref> = track a placeholder for the <ref> to be updated
#                       to this position in the new commits. The <ref> is
#                       updated at the end of the rebase
#
# These lines can be re-ordered; they are executed from top to bottom.
#
# If you remove a line here THAT COMMIT WILL BE LOST.
#
# However, if you remove everything, the rebase will be aborted.
#
```
