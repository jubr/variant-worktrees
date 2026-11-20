## MODIFIED Requirements

### Requirement: The bundled script is the existing server

The bundled script SHALL, when given `--cwd <directory>`, make `<directory>` its working directory, remove that flag from the arguments, and start the same stdio server as `variant mcp`. Without `--cwd` it SHALL leave the working directory unchanged. The `variant-mcp` package SHALL NOT declare a `bin`; the standalone launch is `variant mcp`. A tools list from the bundled script SHALL include `variant_list` and SHALL NOT include `variant_destroy`.

#### Scenario: Working directory flag

- **WHEN** the bundled script starts with `--cwd` set to a directory that contains `variants.yaml`
- **THEN** the server loads that directory's configuration, its tools list includes `variant_list`, and its tools list has no `variant_destroy`

#### Scenario: Standalone launch is unchanged

- **WHEN** the `variant-mcp` package manifest is read and `variant mcp` is started with no extra arguments
- **THEN** the manifest declares no `bin` and the server starts from the process working directory
