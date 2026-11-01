import type { Variant } from "./model.js";
import { formatUptime, stateOf, type VariantState } from "./state.js";
import { useRecords } from "./transport-context.js";

const STATE_ICON: Record<VariantState, string> = {
  watching: "codicon-eye",
  up: "codicon-play-circle",
  down: "codicon-circle-outline",
};

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

const StateBadge = ({ variant }: { variant: Variant }) => {
  const { state, stale } = stateOf(variant);
  return (
    <span className={`state state-${state}`}>
      <span className={`codicon ${STATE_ICON[state]}`} aria-hidden="true" />
      <span data-testid="state">{state}</span>
      {stale ? <span className="stale"> (stale record)</span> : null}
    </span>
  );
};

const VariantRow = ({ variant }: { variant: Variant }) => (
  <li className="variant-row" data-slug={variant.slug} aria-labelledby={`variant-${variant.slug}`}>
    <span className="slug" id={`variant-${variant.slug}`}>
      {variant.slug}
    </span>
    <StateBadge variant={variant} />
    {variant.url ? (
      <a className="url" href={variant.url} target="_blank" rel="noreferrer">
        {variant.url}
      </a>
    ) : null}
    {variant.uptimeSeconds !== undefined ? <span className="uptime">{formatUptime(variant.uptimeSeconds)}</span> : null}
  </li>
);

export const VariantList = () => {
  const records = useRecords();
  if (records.length === 0) {
    return (
      <p className="empty">
        No variants yet. Run <code>variant create</code> to make one.
      </p>
    );
  }
  return (
    <ul className="variant-list">
      {ordered(records).map((variant) => (
        <VariantRow key={variant.slug} variant={variant} />
      ))}
    </ul>
  );
};
