# Example project

A Vite app (`fe`) and a NestJS app (`be`) on SQLite, configured for `variant-worktrees` in `variants.yaml`.
The test suites of `variant-config` and `variant-api` use this directory as their fixture.

```bash
cd example
mise install          # bun and the `variant` CLI (see mise.toml)
bun install
variant config        # the resolved configuration
variant create demo   # a SQLite database for the variant `demo`
SQLITE_DATABASE=./be/example.sqlite bun scripts/seed.mjs
```

```bash
variant watch demo --detach   # fe and be as host processes (bun run dev, bun run start:dev)
variant down demo             # stop them
variant up demo               # fe and be as containers (needs docker or podman; be/Dockerfile)
variant implode demo          # remove the variant, its database and its worktree
```

```bash
variant watch demo --detach   # fe and be as host processes (bun run dev, bun run start:dev)
variant down demo             # stop them
variant up demo               # fe and be as containers (needs docker or podman; be/Dockerfile)
variant implode demo          # remove the variant, its database and its worktree
```

- `fe` proxies `/api` to `be` (`VARIANT_API_PORT`, default 3000) and listens on `PORT` (default 5173).
- `be` reads `PORT` and `SQLITE_DATABASE` from its environment, falling back to `be/.env`; `be/.env.example`
  is the template that `dotenv: .env` in `variants.yaml` copies for a variant.
- `variants.yaml` also shows `storage`, a `steps` entry, `implode.preRm`, `ready`, `env` and `container`. `be` is
  listed first because the nginx of the `fe` container resolves the `be` container by name when it starts.
- A container engine in a VM (colima, podman machine) can only mount directories it shares, usually below `$HOME`.
- `variants.yaml` also shows `storage`, a `steps` entry, `implode.preRm`, `ready`, `env` and `container`. `be` is
  listed first because the nginx of the `fe` container resolves the `be` container by name when it starts.
- A container engine in a VM (colima, podman machine) can only mount directories it shares, usually below `$HOME`.
- `open` on `fe` is the URL of the app: `http://<slug>.vw.localhost:<port>`.
