## ADDED Requirements

### Requirement: Unreachable database in the trees

When the library reports that the configured database cannot be contacted, the Explorer **Variant Worktrees** tree and the activity-bar **Variant Worktrees** tree SHALL keep their variant rows, including `main`. They SHALL show a row above those variants whose label is `Database unreachable`, with a warning icon, a description that names the database and the host, and a tooltip that is the contact warning. The label, description, and tooltip SHALL NOT contain a SQL statement or `Failed query`. The row SHALL disappear when the database can be contacted again. A read that fails for another reason SHALL still be shown as it is today.

#### Scenario: Rows stay, warning leads

- **WHEN** variant `demo` has a state file and the configured database `app` at host `127.0.0.1` cannot be contacted
- **THEN** both trees list `Database unreachable` first, then the variant rows including `main` and `demo`
- **AND** the warning row's description contains `app` and `127.0.0.1`, and its tooltip does not contain `SELECT`

#### Scenario: Warning row leaves

- **WHEN** the database can be contacted again
- **THEN** neither tree shows `Database unreachable`

### Requirement: One warning notification

When the configured database becomes unreachable, the editor SHALL show one non-modal warning notification whose text is the contact warning. Further refreshes while it stays unreachable SHALL NOT show another. After contact returns, a later loss of contact SHALL show one notification again. The notification SHALL NOT contain a SQL statement.

#### Scenario: Once per outage

- **WHEN** the database cannot be contacted and the tree refreshes three times before contact returns
- **THEN** one warning notification is shown, and its text does not contain `SELECT`

#### Scenario: A new outage notifies again

- **WHEN** contact returns and is then lost again
- **THEN** a second warning notification is shown

### Requirement: Library logs on the Variant Worktrees channel

The extension SHALL write each library log event to the existing **Variant Worktrees** log channel at the same level: `trace` as trace, `debug` as debug, `info` as info, `warn` as warning, and `error` as error. It SHALL NOT open a second channel for those events.

#### Scenario: Contact warning reaches the channel

- **WHEN** the library emits the database contact warning
- **THEN** the **Variant Worktrees** log channel receives it as a warning
- **AND** no other log channel is created for it
