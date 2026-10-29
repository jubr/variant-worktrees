# Core

These are the `variant` commands. A slug command takes the slug as a positional argument or as `-s`/`--slug`. The flag wins. Without either, the slug comes from the current worktree branch. `--verbose` prints the full output of quiet provisioning steps.

What `provision`, `up`, and `watch` actually run is set in [Configuration](./configuration).

## config

Print the detected configuration: `variants.yaml`, then `mise.local.toml`, then environment variables.

```bash
variant config
```

## create

Create or refresh a database variant and its worktree. Creating the same isolated variant again is safe.

```bash
variant create -s feature-forty-two
```

## list

List the known database variants.

```bash
variant list
```

## provision

Run the configured install, dotenv, `up`, step, and seed commands. This prepares the variant without leaving a supervised `watch` in the foreground.

```bash
variant provision -s feature-forty-two
```

## up

Recreate the database and run the instances as containers. One runtime exists per slug, so this stops recorded `watch` processes for that variant first.

```bash
variant up -s feature-forty-two
```

## down

Stop the processes and containers of a variant and keep its data, database, and worktree.

```bash
variant down -s feature-forty-two
```

## watch

Run the instances as supervised host processes. This removes the variant's containers first, so `up` and `watch` do not both run.

```bash
variant watch -s feature-forty-two
variant watch -s feature-forty-two --detach
```

Without `--detach`, the command stays attached. It exits 130 on interrupt, 1 when an instance ends or the worktree disappears, and 0 only when detached. `--detach` starts the processes in the background and returns.

## implode

Stop the variant, drop its database and storage, clear its state, and remove its worktree. This includes `down`. It refuses `main`, and it refuses work that is not merged into `variant.baseBranch` unless `--force` is set. The branch itself stays.

```bash
variant implode -s feature-forty-two
variant implode -s feature-forty-two --force
```
