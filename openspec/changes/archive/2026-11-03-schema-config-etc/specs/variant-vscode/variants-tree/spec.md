## MODIFIED Requirements

### Requirement: UI server item

When the `main` record has a `variant-ui` watch, the view SHALL show an item for it above the variants, labelled `UI server`, with the URL as description, an open-in-browser action and a stop action that stops that server.

#### Scenario: Server item

- **WHEN** the UI server runs at `http://ui.vw.localhost:62100`
- **THEN** the view shows a `UI server` item with that URL, and its stop action ends the server

#### Scenario: No server

- **WHEN** no `variant-ui` watch is recorded
- **THEN** the view shows no `UI server` item
