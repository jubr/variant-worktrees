## Purpose

The loopback HTTP surface that serves the variants app and runs variant actions for a browser, protected against other local users, other websites and other hostnames.

## ADDED Requirements

### Requirement: Loopback binding, token and host check

The server SHALL accept connections on the loopback interface only. Every request SHALL carry the run's token, as `Authorization: Bearer <token>` or as the cookie set by the first visit of `/?token=<token>`; a request without a valid token SHALL get 401 and no body detail. A first visit with a valid token query SHALL set an HttpOnly, SameSite=Strict cookie and redirect to the same path without the query. A request whose `Host` header is not `ui.<abbr>.localhost:<port>`, `localhost:<port>` or `127.0.0.1:<port>` SHALL get 421 before any other check. The token SHALL be generated per run from a cryptographically secure source with at least 128 bits.

#### Scenario: No token

- **WHEN** a client requests `GET /api/variants` without a token
- **THEN** the response is 401

#### Scenario: Cookie from first visit

- **WHEN** a browser opens `/?token=<valid>`
- **THEN** the response sets an HttpOnly SameSite=Strict cookie and redirects to `/`, and `GET /api/variants` with that cookie succeeds

#### Scenario: Wrong token

- **WHEN** a client sends `Authorization: Bearer wrong`
- **THEN** the response is 401

#### Scenario: Foreign host name

- **WHEN** a request with a valid token has `Host: evil.example:62100`
- **THEN** the response is 421

#### Scenario: Not reachable from the network

- **WHEN** a client connects to the machine's non-loopback address on the server's port
- **THEN** the connection is refused

### Requirement: Snapshot and events

`GET /api/variants` SHALL return the current variant records as JSON. `GET /api/events` SHALL be a server-sent event stream that sends the current records as its first event and a new event for every delivery of the state subscription, plus a comment line every 15 seconds to keep the connection open. A failure to read the records SHALL be sent as an `error` event and the stream SHALL stay open.

#### Scenario: Snapshot

- **WHEN** a client requests `GET /api/variants` with a valid token
- **THEN** the body is the JSON list of the records `list` returns

#### Scenario: Stream starts with the state

- **WHEN** a client opens `/api/events`
- **THEN** its first event holds the current records

#### Scenario: Change event

- **WHEN** `watch` starts for `demo` while a client is connected
- **THEN** the client receives an event in which `demo` has `mode: watch`

#### Scenario: Read failure

- **WHEN** reading the records fails
- **THEN** the stream sends an `error` event and remains open

### Requirement: Actions

`POST /api/variants/<slug>/watch` SHALL start a detached watch for the variant, `POST /api/variants/<slug>/down` SHALL bring it down, and `POST /api/variants/<slug>/implode` SHALL implode it. Implode SHALL require the JSON body `{"confirm": true}` and SHALL answer 400 without it. Implode of `main` SHALL answer 400 and change nothing. An unknown slug SHALL answer 404. A failing action SHALL answer 500 with `{"error": "<message>"}`. A successful action SHALL answer 200 with the action's result, and a mutating request SHALL be accepted only with `Content-Type: application/json`.

#### Scenario: Watch

- **WHEN** a client posts to `/api/variants/demo/watch`
- **THEN** a detached watch of `demo` runs and the response is 200

#### Scenario: Down

- **WHEN** a client posts to `/api/variants/demo/down` for a watching variant
- **THEN** its processes stop and the response is 200

#### Scenario: Implode needs confirmation

- **WHEN** a client posts to `/api/variants/demo/implode` without `{"confirm": true}`
- **THEN** the response is 400 and `demo` still exists

#### Scenario: Main is protected

- **WHEN** a client posts `{"confirm": true}` to `/api/variants/main/implode`
- **THEN** the response is 400 and `main` is unchanged

#### Scenario: Unknown slug

- **WHEN** a client posts to `/api/variants/nope/watch`
- **THEN** the response is 404

#### Scenario: Action fails

- **WHEN** implode fails because the variant is not merged
- **THEN** the response is 500 and the body carries the error message

#### Scenario: Wrong content type

- **WHEN** a client posts to an action URL as `text/plain`
- **THEN** the response is 415 and nothing runs

### Requirement: Log tail

`GET /api/variants/<slug>/log?lines=<n>` SHALL return the last `n` lines (default 200, at most 2000) of the variant's `runtime.log` as plain text. A variant without a log SHALL answer 404.

#### Scenario: Tail

- **WHEN** the log of `demo` has 500 lines and a client asks for `lines=50`
- **THEN** the body is its last 50 lines

#### Scenario: No log

- **WHEN** `demo` has no `runtime.log`
- **THEN** the response is 404

### Requirement: Static app

`GET /` and every other path outside `/api` SHALL serve the built variants app, with `index.html` for paths that are not files. Responses for the app SHALL carry a content security policy that allows scripts and styles only from the server itself.

#### Scenario: Index

- **WHEN** a client with a valid token requests `/`
- **THEN** the response is the app's `index.html`

#### Scenario: Client route

- **WHEN** a client requests `/variants/demo`
- **THEN** the response is the app's `index.html`

#### Scenario: Policy

- **WHEN** the app is served
- **THEN** the response has a `Content-Security-Policy` header that denies scripts from other origins
