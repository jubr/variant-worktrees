## Context

The step named `seed` already runs the seed phase and is ordered after `provision`. `variant.seed` runs after all steps, in `provisioning.ts`, as a separate command.

## Decisions

- **Remove, do not deprecate.** The key leaves the Zod schema, so the existing unknown-key warning covers old files. No migration code, no mention of the removal in code or docs. The `legacy` placeholder migration keeps working for steps.
- **Keep the `seed` step.** Only the key goes. `seed` stays a builtin step, in the Overview flow, in `variant.steps` and in the `VARIANT_STEP_SEED` skip variable.
- **Seed command wording.** Specs that say "the seed command" outside the four deltas mean the command of the `seed` step. They are not rewritten here.
- **Spec footprint is minimal.** Four deltas: the removed requirement, the Core grouping, the example rule and the provisioning order.
- **`init` first.** Only the order of headings in Core changes. Other pages already link to `core#init`.
