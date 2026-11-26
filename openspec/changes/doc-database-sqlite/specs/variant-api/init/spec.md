## ADDED Requirements

### Requirement: Init writes the detected SQLite file

When the detected database is SQLite, `variant init` SHALL write `db.dialect: sqlite` and the detected file as `db.database`, exactly as detection resolved it, and SHALL NOT write `db.filename`. A SQLite file that autodetection only defaults, `.cache/variants/{slug}.sqlite`, SHALL NOT be written. The written file SHALL load to the same `db.database` as autodetection without it.

#### Scenario: File from the environment

- **WHEN** `SQLITE_DATABASE` is `./data/app.sqlite`
- **THEN** the file has `db.dialect: sqlite` and `database: ./data/app.sqlite`
- **AND** the file has no `filename` key
- **AND** loading it resolves `db.database` to the same value as detection without the file

#### Scenario: File from a URL

- **WHEN** `DATABASE_URL` is `sqlite:///var/data/app.sqlite`
- **THEN** the file has `db.dialect: sqlite` and `database: /var/data/app.sqlite`

#### Scenario: Default file not pinned

- **WHEN** no database setting is detected
- **THEN** the file has no `db` key
