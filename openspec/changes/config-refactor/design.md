## Context

`packages/variant-config/variants.example.yaml` is the target shape: it states every option with a comment, a test keeps it in step with `variants.yaml.schema.json`, and the user has already rewritten it. The code that reads the old keys is spread over `variant-config` (`schema.ts`, `template.ts`, `dotenv.ts`, `autodetect.ts`, `index.ts`) and `variant-api` (`provisioning.ts`, `run-context.ts`, `cleanup.ts`, `containers.ts`, `nginx.ts`, `ready.ts`, `operations/{up,down,watch,implode}.ts`). Schemas are Zod `strictObject`s, so an old key is already a validation error once it leaves the schema. See `proposal.md` for the list of changes; the delta specs hold the behavior.

## Goals / Non-Goals

**Goals:**
- One shape for each concern: instance env (`env.sourceFile`, `env.overrides`), instance URL (`url`), implode cleanup (`preRm`, `discard`), step control (`VARIANT_STEP_<NAME>`, `filterLinesRegex`), container (`dockerfile`, `internalPort`).
- Remove code that only exists to build a static site by hand (nginx configuration, build command, static mount, proxy, volumes, container env).
- Keep `example/` runnable and in step with the schema: the `fe` instance runs under `up` through its own Dockerfile.

**Non-Goals:** see the proposal. No aliases, no `variant migrate-config` command, no behavior change for `db`, `variants`, `supervise`, `chatRenamer`, ports, slugs or worktrees.

## Decisions

**Hard rename, no aliases.** The old keys disappear from the strict schemas, so loading fails with Zod's unknown-key message. The package is at 0.0.x with one known consumer (this repository). Accepting both spellings would keep every old code path alive and need a precedence rule per pair. The exception is `{{port.<key>}}`: an unknown placeholder is currently left in the text silently, so the template renderer throws a message that names `{{<key>.port}}`.

**`env` becomes an object; overrides apply on creation only.** `envAlways` existed because a value such as `PUBLIC_BASE_URL` had to follow the URL on every run. Ports and URLs are stable across runs (recorded in `variants.local.yaml`), so a value written when the copy is created stays correct. The primary worktree is therefore never touched; before, it got `envAlways` applied. `VARIANT_ENV_SOURCE` stays as the only way to name another source file, since `dotenvSource` goes. The storage variable is added to the same write because `variant.storage.envVarName` is documented as "set in instance .env".

**Containers: Dockerfile in, nginx generation out.** `container` is `{ dockerfile, internalPort? }`. The image tag is always `v-<key>:v-<slug>`. `staticSiteConfig`, `nginxConfigPath`, the static mount, the host build step, the volume and proxy handling, `STATIC_IMAGE`, `nginx.ts` and `test/nginx.test.ts` are deleted; `down` stops removing a generated file. `internalPort` defaults to 80 because the replaced case was a static site served by nginx; `be` states 3000.

**What the container receives.** The old container saw the variant variables, then the instance `env`, then `container.env`. With `container.env` gone and `env.overrides` describing host processes (the example sets `PORT: '{{be.port}}'`, the host port, which would shadow the port the image listens on), the container gets only the variant variables. Two of them are host paths and are dropped for a container: `SQLITE_DATABASE` and the storage variable. The alternative, mounting them, needs the `volumes` option the user removed.

**Proxy lives in the `fe` Dockerfile.** The final stage is `FROM nginx:alpine` with an nginx template (`/etc/nginx/templates/default.conf.template`). The base image renders `*.template` files with `envsubst` at start, limited by `NGINX_ENVSUBST_FILTER=VARIANT_` so nginx's own `$host`, `$uri` and friends survive. The template uses `VARIANT_SLUG` (already in the container environment) to address the other container by its fixed name `v-be-${VARIANT_SLUG}` on the shared network, with port 3000 written in the template. Earlier stages build the app with `bun` using the worktree as context, so `fe/Dockerfile` copies the root `package.json` and `bun.lock` like `be/Dockerfile` does. The `server_name` is `_`; the host name restriction disappears with `NGINX_HOST`.

**`preRm` is one list of globs.** It merges the old directory-name list and the untracked-glob list. A pattern is matched from the project directory and from each instance directory, which keeps `dist` working below `fe/` and `be/` (old `preRm`) and `openspec/changes/{{slug}}/...` working from the root (old `untracked`). It also removes root-level `node_modules`, which the old list missed when instances existed. A match that is or contains a tracked file is skipped, the old `untracked` rule applied to the whole list; the old `preRm` removed tracked directories without asking, which no real use depended on. Removal still happens before the report, so the report lists what is really lost.

**Step skipping moves to the environment.** `unlessEnv` encoded a project-specific variable in the file. `VARIANT_STEP_<NAME>=no` is derived from the step name with the existing `envSegment` rule used for `VARIANT_<K>_PORT`, so a caller can skip any step without editing the file. Step names are restricted and checked for segment collisions to make that mapping unambiguous.

**No variant-wide `up` / `watch`.** `runtimeCommandFor` returns the instance command only; the `variant` key in the watch map and its warning text go. `variant.seed` stays: a seed is per variant, not per instance.

**Placeholder `{{<key>.port}}`.** The renderer recognizes `<key>.port` with the instance-key charset. A key cannot clash with the fixed placeholders because those have no dot.

**Order of work.** Specs and schema first (strict schemas make every old fixture fail loudly), then the runtime code that reads each new field, then `example/`, then docs. Every task group ends green and is committed on its own, as CONTRIBUTING.md asks.

## Risks / Trade-offs

- [Existing `variants.yaml` files break] → The error names the unknown key; the proposal and docs list every rename. Only this repository's example and test fixtures are known consumers.
- [Container loses `env` and `volumes`, so the example `be` has no host SQLite file inside the container] → The example `be` image keeps its own database path (`ENV SQLITE_DATABASE=/data/variant.sqlite` in its Dockerfile) and starts empty; `README` of the example says that `watch` uses the seeded host file and `up` runs a fresh in-container database. Real projects that need mounts must wait for a later change or bake what they need into the image.
- [`fe/Dockerfile` hard-codes the name and port of the `be` container] → Acceptable for an example; the naming rule `v-<key>-<slug>` is a documented contract in the runtime spec.
- [`preRm` now deletes matches at the project root as well] → Tracked paths are protected, and the removal happens right before the worktree itself is removed.
- [Tests and docs outnumber source edits] → Grep for each removed key (`dotenv`, `envAlways`, `unlessEnv`, `show`, `open:`, `{{port.`, `restore`, `untracked`, `container.static`) is part of the final task.

## Migration Plan

1. Land the change on one branch; there is no data migration.
2. Users rewrite `variants.yaml` by hand using the table in `docs/guide/configuration.md`, which maps each old key to its new place.
3. Rollback is reverting the merge; runtime state files (`variants.local.yaml`) keep the same shape, so nothing needs to be cleaned up.
