import { useState } from "react";
import { Busy, IconButton, RowError } from "./Controls.js";
import { ImplodeDialog } from "./ImplodeDialog.js";
import type { Variant } from "./model.js";
import { formatUptime, stateOf, type VariantState } from "./state.js";
import { useConnectionState, useTransport } from "./transport-context.js";
import { useAction } from "./use-action.js";

const STATE_ICON: Record<VariantState, string> = {
  watching: "codicon-eye",
  up: "codicon-play-circle",
  down: "codicon-circle-outline",
};

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

export const VariantRow = ({ variant }: { variant: Variant }) => {
  const transport = useTransport();
  const connected = useConnectionState() !== "disconnected";
  const { pending, error, run } = useAction();
  const [confirming, setConfirming] = useState(false);
  const { slug } = variant;
  const { state } = stateOf(variant);
  const idle = connected && !pending;
  const dirty = variant.implodeClean === false;

  return (
    <li className="variant-row" data-slug={slug} aria-labelledby={`variant-${slug}`} aria-busy={pending}>
      <span className="slug" id={`variant-${slug}`}>
        {slug}
      </span>
      <StateBadge variant={variant} />
      {variant.url ? (
        <a className="url" href={variant.url} target="_blank" rel="noreferrer">
          {variant.url}
        </a>
      ) : null}
      {variant.uptimeSeconds !== undefined ? (
        <span className="uptime">{formatUptime(variant.uptimeSeconds)}</span>
      ) : null}
      <span className="controls">
        {pending ? <Busy /> : null}
        <IconButton
          icon="play"
          label={`variant watch ${slug}`}
          disabled={!idle || state === "watching"}
          onClick={() => void run(() => transport.watch(slug))}
        />
        <IconButton
          icon="debug-stop"
          label={`Stop ${slug}`}
          disabled={!idle || state === "down"}
          onClick={() => void run(() => transport.down(slug))}
        />
        <IconButton
          icon="output"
          label={`Show output of ${slug}`}
          disabled={!idle || variant.log === undefined}
          onClick={() => void run(() => transport.showOutput(slug))}
        />
      </span>
      {slug === "main" ? null : (
        <IconButton
          className={dirty ? "implode-dirty" : "implode-clean"}
          icon="trash"
          label={dirty ? `Implode ${slug}, implode would fail` : `Implode ${slug}`}
          disabled={!idle}
          onClick={() => setConfirming(true)}
        />
      )}
      {error === undefined ? null : <RowError>{error}</RowError>}
      {confirming ? (
        <ImplodeDialog
          slug={slug}
          onCancel={() => setConfirming(false)}
          onAccept={() => {
            setConfirming(false);
            void run(() => transport.implode(slug, true));
          }}
        />
      ) : null}
    </li>
  );
};
