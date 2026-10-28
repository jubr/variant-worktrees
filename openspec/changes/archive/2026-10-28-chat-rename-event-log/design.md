## Context

`trigger.ts` subscribes to `onDidChangeAgentHostSessionCatalogTitle`. Its listener skips every chat it has already checked, then reads the first prompt and logs a decision. Events that are skipped, or that arrive for a chat that was already checked, leave no trace.

## Decisions

- **Log first, in the listener.** The entry is written as the first statement of the listener, before the `checked` guard. Logging inside `catalogTitleDecision` would miss skipped events.
- **`debug` level.** A chat can produce several title events, and the channel defaults to `info`. Debug keeps the default log quiet and still answers "did Cursor send an event" once the level is raised. Rejected: `info`, which adds a line per event for every user.
- **Reuse category `title-event`.** The decision and prompt lines already use it, so one filter shows the whole path of an event. The logger is created per event with `log.child("title-event")`, as the decision logger is.
- **Fields `session` and `title`.** Same key as the decision line. The title field is dropped when `undefined` by the logger, so no special case in the code.

## Risks

- The title is user-visible text, so it ends up in the log. Titles already appear in `rename …; title …` lines, so no new exposure.

## Rollback

Remove the one log call and its test.
