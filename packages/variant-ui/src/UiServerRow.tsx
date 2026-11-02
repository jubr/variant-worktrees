import { Busy, IconButton, RowError } from "./Controls.js";
import type { InstanceFacts } from "./model.js";
import { useConnectionState, useTransport } from "./transport-context.js";
import { useAction } from "./use-action.js";

/** The row of the UI server, which records itself as the `variant-ui` instance of `main`. */
export const UiServerRow = ({ instance }: { instance: InstanceFacts }) => {
  const transport = useTransport();
  const connected = useConnectionState() !== "disconnected";
  const { pending, error, run } = useAction();
  return (
    <li className="variant-row ui-server" aria-labelledby="ui-server-label" aria-busy={pending}>
      <span className="slug" id="ui-server-label">
        UI server
      </span>
      {instance.url ? (
        <a className="url" href={instance.url} target="_blank" rel="noreferrer">
          {instance.url}
        </a>
      ) : null}
      {transport.origin === "editor" ? (
        <span className="controls">
          {pending ? <Busy /> : null}
          <IconButton
            icon="debug-stop"
            label="Stop UI server"
            disabled={!connected || pending}
            onClick={() => void run(() => transport.down("variant-ui"))}
          />
        </span>
      ) : null}
      {error === undefined ? null : <RowError>{error}</RowError>}
    </li>
  );
};
