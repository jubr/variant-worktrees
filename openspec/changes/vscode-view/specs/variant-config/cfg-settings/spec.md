## ADDED Requirements

### Requirement: Project abbreviation

The system SHALL accept an optional `variant.abbr`, a string of lowercase letters and digits, optionally separated by single `-`, that labels the project in hostnames and `open` URL templates. When it is absent the system SHALL derive it from the base name of the main checkout directory: split the name into words at every character that is not a letter or digit and at every lowercase-to-uppercase boundary, take the first letter or digit of each word, and lowercase the result. A name without any letter or digit SHALL give `app`. The resolved configuration SHALL always carry the abbreviation. An explicit value that does not match the pattern SHALL fail validation.

#### Scenario: Hyphenated name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `variant-worktrees`
- **THEN** the resolved abbreviation is `vw`

#### Scenario: Title case name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `OtherTitleCase`
- **THEN** the resolved abbreviation is `otc`

#### Scenario: Camel case name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `moreStuff`
- **THEN** the resolved abbreviation is `ms`

#### Scenario: Underscore name

- **WHEN** `variant.abbr` is absent and the main checkout directory is `lower_example`
- **THEN** the resolved abbreviation is `le`

#### Scenario: Single word

- **WHEN** `variant.abbr` is absent and the main checkout directory is `shop`
- **THEN** the resolved abbreviation is `s`

#### Scenario: Linked checkout layout

- **WHEN** the configuration is loaded from the worktree `/work/vw/_v-add-auth` of the main checkout `/work/vw/variant-worktrees`
- **THEN** the resolved abbreviation is `vw`

#### Scenario: Explicit value wins

- **WHEN** `variant.abbr` is `shop` and the main checkout directory is `variant-worktrees`
- **THEN** the resolved abbreviation is `shop`

#### Scenario: Invalid value

- **WHEN** `variant.abbr` is `Shop`, `a.b` or an empty string
- **THEN** loading the configuration fails validation

#### Scenario: Nothing to abbreviate

- **WHEN** `variant.abbr` is absent and the main checkout directory is `___`
- **THEN** the resolved abbreviation is `app`
