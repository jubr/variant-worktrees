import { sortVariants } from "./sort.js";
import { UI_WATCH_KEY } from "./state.js";
import { useRecords, useSort } from "./transport-context.js";
import { UiServerRow } from "./UiServerRow.js";
import { VariantRow } from "./VariantRow.js";

export const VariantList = () => {
  const records = useRecords();
  const sort = useSort();
  if (records.length === 0) {
    return (
      <p className="empty">
        No variants yet. Run <code>variant create</code> to make one.
      </p>
    );
  }
  const server = records.find((variant) => variant.slug === "main")?.watches?.[UI_WATCH_KEY];
  return (
    <ul className="variant-list">
      {server && server.alive !== false ? <UiServerRow watch={server} /> : null}
      {sortVariants(records, sort).map((variant) => (
        <VariantRow key={variant.slug} variant={variant} />
      ))}
    </ul>
  );
};
