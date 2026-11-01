import { useConnectionState } from "./transport-context.js";
import { VariantList } from "./VariantList.js";

export const App = () => {
  const connection = useConnectionState();
  return (
    <main className="app" data-connection={connection}>
      {connection === "disconnected" ? (
        <p role="alert" className="notice">
          Disconnected. Showing the last known state; actions are off until the connection returns.
        </p>
      ) : null}
      <VariantList />
    </main>
  );
};
