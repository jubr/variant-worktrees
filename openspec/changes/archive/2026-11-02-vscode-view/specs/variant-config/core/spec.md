## MODIFIED Requirements

### Requirement: Instance open URL

The system SHALL accept an optional `open` string on any entry of `variant.instances`: a URL template that may contain the placeholders `{{slug}}`, `{{abbr}}` (the resolved `variant.abbr`) and `{{port}}`, for example `http://{{slug}}.{{abbr}}.localhost:{{port}}`. `open` SHALL NOT be an empty string. A Vite instance found by autodetection SHALL carry the default template `http://{{slug}}.{{abbr}}.localhost:{{port}}`; a detected NestJS instance and an explicit instance carry only what they set. The system SHALL offer a function that returns the template of an instance with all placeholders replaced, or nothing when the instance has no template. This change does not launch the URL.

#### Scenario: Open template accepted

- **WHEN** an instance of kind `vite` or `nestjs` sets `open: http://{{slug}}.vw.localhost:{{port}}`
- **THEN** loading succeeds and the resolved instance carries that exact string

#### Scenario: Empty open template

- **WHEN** an instance sets `open: ""`
- **THEN** loading the configuration fails validation

#### Scenario: Autodetected Vite instance

- **WHEN** `variant.instances` is absent and a searched subdirectory contains Vite configuration
- **THEN** the detected instance carries the default `open` template, and a detected NestJS instance carries none

#### Scenario: Placeholders replaced

- **WHEN** the URL of an instance with the default template is requested for slug `add-auth`, the abbreviation is `vw` and the instance's port is 62060
- **THEN** the result is `http://add-auth.vw.localhost:62060`

#### Scenario: Abbreviation placeholder in an explicit template

- **WHEN** an instance sets `open: http://{{abbr}}-{{slug}}.localhost:{{port}}`, the abbreviation is `otc`, the slug is `demo` and the port is 62060
- **THEN** the result is `http://otc-demo.localhost:62060`
