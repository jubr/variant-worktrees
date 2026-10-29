## Why

`variants.yaml` grew option by option: three keys for one environment file (`dotenv`, `dotenvSource`, `env`/`envAlways`), three lists for one cleanup (`preRm`, `untracked`, `restore`), a `skip when` map next to every step, and a container description that rebuilds nginx by hand (`static`, `build`, `proxy`, `volumes`, `env`, `image`). The result is hard to read, `variant.up` and `variant.watch` do not make sense above the instances, and the static-site logic lives in TypeScript where the project's own Dockerfile belongs. `variants.example.yaml` already shows the intended shape; the schema, runtime, specs, docs and example project still describe the old one.

## What Changes

- **BREAKING** Instance environment: `dotenv`, `dotenvSource`, `env` and `envAlways` become one `env` object: `sourceFile` (env file relative to the instance directory, copied for a variant) and `overrides` (templated values for the instance's commands and, when the copy is created, the copy). `envAlways` is gone; overrides are written when the copy is created.
- **BREAKING** Instance `open` is renamed `url`. The boolean `variant.open` is unchanged.
- **BREAKING** Template `{{port.<key>}}` becomes `{{<key>.port}}`; the old form fails with a message that names the new one.
- **BREAKING** `variant.storage.env` is renamed `envVarName`; the variable is also written into an instance's env file copy.
- **BREAKING** Steps: `show` is renamed `filterLinesRegex`; `unlessEnv` is removed in favour of the environment variable `VARIANT_STEP_<NAME>=no`, which skips the step; step names are limited to `[A-Za-z0-9_-]+`.
- **BREAKING** Implode: `untracked` is merged into `preRm` (glob patterns of paths to `rm -rf` before the report, `{{slug}}` replaced, matched in the worktree root and in every instance directory); `restore` is renamed `discard`.
- **BREAKING** `variant.up` and `variant.watch` are removed; only an instance has `up` and `watch`. `variant.seed` stays.
- **BREAKING** Instance `container` shrinks to `dockerfile` (required) and `internalPort` (default 80, formerly `port`). `image`, `build`, `static`, `proxy`, `volumes` and `env` are removed, together with the generated nginx configuration. The container only receives the variant variables.
- The example project's `fe` becomes a multi-stage `fe/Dockerfile` based on `nginx:alpine` that builds the app, serves it, and proxies `/api/` to the `be` container.
- Schema, `variants.yaml.schema.json`, `variants.example.yaml`, autodetection, runtime code, tests, specs, docs, READMEs and `example/` follow the new shape.

Non-goals: aliases or a migration command for the old keys; new placeholders beyond `{{<key>.port}}`; container volumes or container-only environment under another name; changes to `db`, `variants`, `supervise`, `chatRenamer` or the other `variant` settings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `variant-config/core`: instance `url` (was `open`), instance `env` object (was `dotenv`), example project.
- `variant-config/cfg-instances`: instance runtime options, instance container.
- `variant-config/cfg-settings`: storage `envVarName`, implode settings.
- `variant-config/cfg-provisioning`: provisioning steps, command templates.
- `variant-api/provisioning`: order, command environment, step skipping and filtering, env file copy, storage directory, command echo, project directory.
- `variant-api/implode`: implode cleanup.
- `variant-api/runtime`: container run, removal of the static site proxy, watch commands, state recording, readiness, down, container echo, watch warning.
- `variant-mcp/tools`: `variant_provision` scenario that used `variant.up`.

## Impact

- `packages/variant-config`: `schema.ts`, `template.ts`, `dotenv.ts`, `autodetect.ts`, `index.ts`, `variants.example.yaml`, `variants.yaml.schema.json`, tests.
- `packages/variant-api`: `provisioning.ts`, `run-context.ts`, `cleanup.ts`, `containers.ts`, `ready.ts`, `operations/{up,down,watch,implode}.ts`; `nginx.ts` and its test are deleted; tests.
- `packages/variant-mcp` test fixtures, `docs/`, `README.md`, `example/` (`variants.yaml`, `fe/Dockerfile`, `be/Dockerfile`, README, Vite and Nest sources that name `open`/`{{port.be}}`).
- Existing `variants.yaml` files using the old keys stop validating; users edit them by hand.
