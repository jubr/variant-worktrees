## MODIFIED Requirements

### Requirement: Core groups lifecycle commands

The Core page SHALL have the second-level sections *Lifecycle commands* and *Other commands*, followed by *Global flags*. *Lifecycle commands* SHALL hold `init` first, then `create`, `provision`, `up`, `watch`, `down`, `deprovision` and `implode` as third-level headings, in the order of the flow of steps after `init`. *Other commands* SHALL hold `config`, `list`, `status`, `ui` and `completions` as third-level headings. Every command heading keeps the id of its name, so `core#create` stays a valid deep link.

#### Scenario: Commands are grouped

- **WHEN** the headings of the built Core page are listed in page order
- **THEN** the second-level headings are Lifecycle commands, Other commands and Global flags
- **AND** the third-level headings below Lifecycle commands are `init`, `create`, `provision`, `up`, `watch`, `down`, `deprovision`, `implode`
- **AND** the third-level headings below Other commands are `config`, `list`, `status`, `ui`, `completions`

### Requirement: Overview steps are short and link to commands

Each builtin step of the Overview that is also a command (`create`, `provision`, `watch`, `down`, `deprovision`, `implode`) SHALL be a minimal explanation of what the step does, of at most 60 words, with no list, no table, no flag or option list and no configuration example. It SHALL end with the sentence `More details at Core [<command>](core#<command>).`, linking to the section of that command in Core. What the step no longer says SHALL be in that Core section. A step that is not a command, `seed`, and the Custom Steps and Custom multi-tenancy steps sections SHALL keep their full explanation and full configuration example, and SHALL link to the headings of the keys they use, such as `variant.steps`, `db.multi` and `db.multi.schemaPrefix`. The Overview SHALL show `VARIANT_STEP_<STEP>=no` as typed.

#### Scenario: Command steps are short and end with a Core link

- **WHEN** the section of each of `create`, `provision`, `watch`, `down`, `deprovision` and `implode` in the built Overview page is read
- **THEN** it has at most 60 words before its last paragraph and contains no list, table or fenced code
- **AND** its last paragraph is `More details at Core` followed by a link whose text is the command and whose target is `/guide/core#<command>`, and a period

#### Scenario: The seed step keeps its explanation and example

- **WHEN** the section `seed` of the built Overview page is read
- **THEN** it contains fenced YAML that sets the `seed` step
- **AND** it links to the Configuration heading of `variant.steps`
- **AND** it has no `More details at` sentence

#### Scenario: Custom steps keep their examples

- **WHEN** the built Overview page is read
- **THEN** its Custom Steps and Custom multi-tenancy steps sections each contain fenced YAML
- **AND** the multi-tenancy section links to the Configuration headings of `db.multi`

#### Scenario: Core carries what the Overview drops

- **WHEN** the built Core page is read
- **THEN** its `provision` and `deprovision` sections link to the Configuration headings of `variant.steps` and `db.multi`
- **AND** its `watch` section names `--reprovision`

