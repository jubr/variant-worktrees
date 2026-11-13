## MODIFIED Requirements

### Requirement: Awake option defaults and schema

`chat-renamer-config` SHALL own `awake.when`, `awake.cmd`, and `awake.graceDelaySecs` with the other chat renamer options. `awake.when` SHALL be `chatsActive` or `never`, default `chatsActive`. `awake.cmd` SHALL default to `caffeinate -disu -w ${extensionHostPid}`, the command detected for `caffeinate`. `awake.graceDelaySecs` SHALL be an integer of at least 0, default 180. The main entry SHALL export `DEFAULT_AWAKE_WHEN`, `DEFAULT_AWAKE_CMD`, `DEFAULT_AWAKE_GRACE_DELAY_SECS`, and the `awake.when` enumeration without loading any schema library. It SHALL NOT export `awake.what`. The `./schema` entry SHALL accept an optional object `awake` on `ChatRenamerConfigSchema`, with optional `when`, `cmd`, and `graceDelaySecs`. An absent `awake`, and `awake` with no fields, SHALL be valid. A value outside the `when` enumeration, a blank `cmd`, a `graceDelaySecs` below 0 or not an integer, and an unknown key inside `awake` (including `what`), SHALL be rejected. The renamer and `variant-config` SHALL take these defaults and this schema from this package instead of defining their own copies.

#### Scenario: Defaults without Zod

- **WHEN** a consumer imports the main entry
- **THEN** it receives `chatsActive`, `caffeinate -disu -w ${extensionHostPid}`, and `180` as the awake defaults and does not load Zod

#### Scenario: Enumerations

- **WHEN** the awake schemas parse `chatsActive`, `never`, `always`, `caffeinate -disu -w ${extensionHostPid}`, and `""`
- **THEN** they accept the first two and the command, and reject `always` and the empty command

#### Scenario: Empty section

- **WHEN** `ChatRenamerConfigSchema` parses `{}` and `{ awake: {} }`
- **THEN** both are accepted

#### Scenario: Unknown awake key

- **WHEN** `ChatRenamerConfigSchema` parses `{ awake: { what: "screen" } }`
- **THEN** it rejects it

#### Scenario: Grace delay schema

- **WHEN** the grace schema parses `0`, `60`, `-1`, and `1.5`
- **THEN** it accepts `0` and `60` and rejects the other two

#### Scenario: File value

- **WHEN** `variants.yaml` sets `chatRenamer.awake.when` to `never`, `chatRenamer.awake.cmd` to `caffeinate -disu -w ${extensionHostPid}`, and `chatRenamer.awake.graceDelaySecs` to `0`
- **THEN** the loaded section is `awake.when` `never`, that command, and `awake.graceDelaySecs` `0`
