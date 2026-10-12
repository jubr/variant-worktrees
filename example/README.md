# Example project

A Vite app (`fe`) and a NestJS app (`be`) on SQLite, configured for `variant-worktrees` in `variants.yaml`.
The test suites of `variant-config` and `variant-api` use this directory as their fixture.

```bash
cd example
mise install          # bun, node and the `variant` CLI (see mise.toml)
bun install
variant config        # the resolved configuration
variant create demo   # a SQLite database for the variant `demo`
SQLITE_DATABASE=./be/example.sqlite node scripts/seed.mjs
```

- `fe` proxies `/api` to `be` (`VARIANT_API_PORT`, default 3000) and listens on `PORT` (default 5173).
- `be` reads `PORT` and `SQLITE_DATABASE` from its environment, falling back to `be/.env`; `be/.env.example`
  is the template that `dotenv: .env` in `variants.yaml` copies for a variant.
- `open` on `fe` is the URL of the app: `http://<slug>.vw.localhost:<port>`.
