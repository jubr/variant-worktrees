## Context

The root `variants.yaml` is the repository's dogfood configuration for `variant watch`; `example/variants.yaml` is the
standalone sample, used as a test fixture. The example `fe` already reads `PORT` and `VARIANT_API_PORT` (its Vite config),
and `be` reads `PORT`. Their `package.json` files offer `dev`/`build:watch` and `start:dev`/`build:watch`, but no
scripts named `app:watch` or `server:watch`.

## Goals / Non-Goals

**Goals:**
- Root `variants.yaml` mirrors the port wiring of `example/variants.yaml`, and uses the new scripts.
- One obvious script per app that builds, then watches.

**Non-Goals:**
- Changing `example/variants.yaml`, its containers, or the Dockerfiles.
- New schema keys, such as a separate `build` command on a watch.

## Decisions

- **Scripts live in the example packages** (`app:watch` in `example/fe`, `server:watch` in `example/be`), not in the
  YAML. The YAML stays a one-line command per watch; the build-then-watch sequence is app knowledge.
  Alternative: `watch: bun run build && bun run dev` inline in YAML, rejected as shell logic in config.
- **Build, then watch the serving process.** `app:watch` is `bun run build && bun --bun vite` (build once for an early
  type/bundle failure, then the Vite dev server with HMR on `PORT`). `server:watch` is
  `bun run build && bun --watch --no-clear-screen src/main.ts` (the existing `start:dev` behavior after a build).
  Alternative: `build:watch` only, rejected because it serves nothing on `${port}`.
- **`ready` checks** reuse `example/variants.yaml`: `/api` for `be`, `/` for `fe`.
- **Port wiring copied from the example**: `be` before `fe`, `VARIANT_API_PORT: '${be.port}'` on `fe`.
- Existing `dev` and `start:dev` scripts stay; the container and README flows keep using them.

## Risks / Trade-offs

- The initial build delays the first serve → `ready` timeout (`readyTimeoutSeconds`, 180) covers it.
- A build failure blocks the watch from starting → intended; the error shows in `watch.log`.
- Root YAML and `example/variants.yaml` can drift → the new test pins the root file's ports and commands.

## Open Questions

- Whether `example/variants.yaml` should adopt `app:watch`/`server:watch` too; deferred, it is a fixture with its own spec.
