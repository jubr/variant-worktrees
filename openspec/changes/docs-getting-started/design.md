## Context

Docs-only change; see proposal.md for motivation. The site is VitePress under `docs/`; `scripts/docs-site.spec.ts` builds it and asserts on the HTML (headings, links, sidebar order, fenced code), and `scripts/docs-coverage.spec.ts` checks that schema keys and commands have headings. Existing rules that bind this work: every inline mention of a configuration key links to its heading; every command link reads ``[`variant <name>`](…#variant-<name>)``; one sentence per line; no committed machine paths.

`resolveSteps` in `variant-config` already places `runAfter` siblings in file order after the anchor, and `runBefore` siblings in file order before it, so the new sentences describe existing behavior and need no code.

## Goals / Non-Goals

**Goals:**
- A reader goes Getting Started → Overview → Installation → first variant without a detour.
- Configuration owns everything about writing `variants.yaml`, including custom steps; Overview owns the flow.
- Installation says each fact once and links to `variant init`.

**Non-Goals:**
- No product code, no change to the `init` command or its output.
- Getting Started (`docs/index.md`) keeps `mise use github:jubr/variant-worktrees`. `init` writes the `github:` backend into the project's mise file, while the Installation page runs `variant init` once through the `packslip:` backend. Aligning the two is a separate decision.
- No redirect for the two old anchors.

## Decisions

- **Move, not copy, the custom-step sections.** The two sections go to Configuration as second-level sections before *Templates* (after *Database options*, because the multi-tenant example is about `db.multi`). Their headings keep their names, so only the page part of the URL changes. Alternative: leave a short pointer on the Overview; rejected because *Next steps* already links to Configuration.
- **`VARIANT_STEP_<STEP>=no` stays on the Overview** in the intro of Flow of Steps. It applies to every step, builtin or custom, so it belongs to the flow, not to the custom-step section.
- **Installation is a flow step, not a command.** It gets a third-level heading under *Flow of Steps* like the others, with one short paragraph and a link to `/guide/installation`, and no `More details at Commands` sentence. The flow line gains `Installation →` at its start.
- **Installation page shape.** Four second-level headings: *1. Install mise*, *2a. Extension for VSCode and Cursor*, *2b. Install with `variant init`*, *3. Review `variants.yaml`*. The numbering is in the heading text so the outline shows the alternatives. "Rename → Extension for VSCode and Cursor" is read as the section heading, not the page title: the page stays *Installation*, which the Overview and sidebar link to.
- **Examples are real.** The `init` output and the `variants.yaml` are captured by running `init` in a scratch project with Postgres settings in its environment, then trimmed only of machine paths. Secrets are `${NAME}` references by design of `init`.
- **Bare `@`.** The command is `mise x packslip:jubr/variant-worktrees@ -- variant init`, ending in a bare `@` as requested, not `@latest`.
- **Next steps as prose.** Sentences such as "To set up a workspace around your Git project, read [Workspace](/guide/workspace)." One link or a few per sentence; a test asserts the links and that the section is not a link-only list.
- **Spec placement.** All behavior lands in `docs/site`; `variant-api/multi-schema` only moves the place its guide requirement names for the custom-step headings.

## Risks / Trade-offs

- [External links to `overview#custom-steps` break] → Documented as BREAKING in the changelog; all internal links are updated and the link-resolution test covers them.
- [`packslip:` in the docs and `github:` written by `init` look inconsistent] → Called out as a non-goal and in the change summary for the user to decide.
- [The `custom1` / `runAfter: watch` sentence lists `watch` before `custom1` although `watch` stays attached] → The sentence says what `variant watch` runs and in which order, the same order `resolveSteps` produces.
