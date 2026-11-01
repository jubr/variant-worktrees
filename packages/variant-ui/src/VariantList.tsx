import type { Variant } from "./model.js";
import { UI_INSTANCE_KEY } from "./state.js";
import { useRecords } from "./transport-context.js";
import { UiServerRow } from "./UiServerRow.js";
import { VariantRow } from "./VariantRow.js";

/** `main` first, the rest by slug. */
const ordered = (records: readonly Variant[]): Variant[] =>
  [...records].sort((a, b) => {
    if (a.slug === b.slug) {
      return 0;
    }
    if (a.slug === "main") {
      return -1;
    }
    if (b.slug === "main") {
      return 1;
    }
    return a.slug < b.slug ? -1 : 1;
  });

export const VariantList = () => {
  const records = useRecords();
  if (records.length === 0) {
    return (
      <p className="empty">
        No variants yet. Run <code>variant create</code> to make one.
      </p>
    );
  }
  const server = records.find((variant) => variant.slug === "main")?.instances?.[UI_INSTANCE_KEY];
  return (
    <ul className="variant-list">
      {server && server.alive !== false ? <UiServerRow instance={server} /> : null}
      {ordered(records).map((variant) => (
        <VariantRow key={variant.slug} variant={variant} />
      ))}
    </ul>
  );
};
