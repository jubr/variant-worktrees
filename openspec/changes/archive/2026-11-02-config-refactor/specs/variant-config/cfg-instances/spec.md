## MODIFIED Requirements

### Requirement: Instance runtime options
The system SHALL accept on any entry of `variant.instances` these optional settings: `env` (an object with `sourceFile` and `overrides`, see the instance env requirement of `variant-config/core`), `install` (a shell command) and `ready` (a URL path starting with `/`). The templated `env.overrides` SHALL be passed to the commands of that instance in `up` and `watch` and written into its env file copy when the copy is created. `install` SHALL run in the instance directory when that directory has no `node_modules`. `ready` SHALL be a path that answers an HTTP request with a success status when the instance serves.

#### Scenario: Options accepted

- **WHEN** an instance sets `env: { overrides: { PORT: "{{port}}", PUBLIC_BASE_URL: "{{url}}" } }`, `install: bun install --frozen-lockfile` and `ready: /api/health/live`
- **THEN** loading succeeds and the resolved instance carries them

#### Scenario: Ready path without slash

- **WHEN** an instance sets `ready: api/health`
- **THEN** loading the configuration fails validation

### Requirement: Instance container
The system SHALL accept an optional `container` on any entry of `variant.instances` that describes how the instance runs under `up`. It has a required `dockerfile` (relative to the worktree, built with the worktree as context) and an optional `internalPort` (the port inside the container, defaulting to 80). The Dockerfile owns everything else about the container: its base image, its build, the files it serves and its web server configuration. A `container` without `dockerfile`, with an `internalPort` that is not a positive integer, or with any other key (including the former `image`, `build`, `static`, `port`, `proxy`, `volumes` and `env`) SHALL fail validation.

#### Scenario: Static site with proxy

- **WHEN** an instance `fe` sets `container: { dockerfile: fe/Dockerfile }` and `be` sets `container: { dockerfile: be/Dockerfile, internalPort: 3000 }`
- **THEN** loading succeeds; the Dockerfile of `fe` builds, serves and proxies

#### Scenario: Application container without port

- **WHEN** an instance sets `container: { dockerfile: be/Dockerfile }` without `internalPort`
- **THEN** loading succeeds and `up` publishes the instance to container port 80

#### Scenario: Container without Dockerfile

- **WHEN** an instance sets `container: { internalPort: 3000 }` or `container: { image: app:latest }`
- **THEN** loading the configuration fails validation

#### Scenario: Proxy to unknown instance

- **WHEN** a container sets `proxy: { path: /api/, to: be }`, whether or not `be` exists
- **THEN** loading the configuration fails validation naming `proxy`

#### Scenario: Other former container keys refused

- **WHEN** a container sets `static: dist`, `build: "bunx vite build"`, `volumes: [...]`, `env: {...}` or `port: 3000`
- **THEN** loading the configuration fails validation
