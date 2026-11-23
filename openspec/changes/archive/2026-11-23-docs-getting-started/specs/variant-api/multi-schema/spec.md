## MODIFIED Requirements

### Requirement: Lifecycle in the guide

The Overview page of the guide SHALL be linked above Core and SHALL document the builtin steps under the heading `Flow of Steps`, in the order `create`, `provision`, `seed`, `watch`, `down`, `deprovision`, `implode`, after a section `Installation` that links to the Installation page. The text SHALL say that a later step implies the steps above it, that `down` only stops watches, that `deprovision` implies `down`, and that `implode` implies `deprovision`. It SHALL show `--reprovision` on `watch`. The deprovision section SHALL say that a step named `deprovision` replaces the builtin drop, and that with no such step the builtin drops the schema, or every schema under the prefix. A heading `Custom Steps` on the Configuration page of the guide SHALL show a step `migrations` with `cmd`, `dir`, `env`, `filterLinesRegex` and `runAfter: seed`, and the page SHALL say that `runBefore` and `runAfter` name a builtin step or another custom step. A heading `Custom multi-tenancy steps` after that, on the same page, SHALL show the witches example from the design, including `schemaPrefix`, `tenantsCmd`, `provision`, `seed`, `migrations` and `deprovision`. The README SHALL NOT contain this section.

#### Scenario: Guide order

- **WHEN** `docs/guide/overview.md` is read
- **THEN** the heading `Installation` precedes the heading `Flow of Steps`, which lists create, provision, seed, watch, down, deprovision and implode in that order, and the seed step says the project supplies the script

#### Scenario: Migrations example

- **WHEN** the heading `Custom Steps` of `docs/guide/configuration.md` is read
- **THEN** it shows `runAfter: seed` and says `runBefore` and `runAfter` name a builtin step or another step

#### Scenario: README stays free of the flow

- **WHEN** `README.md` is read
- **THEN** it has no heading `Flow of Steps`
