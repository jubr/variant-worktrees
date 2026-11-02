import { createContext, type ReactNode, useContext, useSyncExternalStore } from "react";
import type { Variant } from "./model.js";
import type { VariantSort } from "./sort.js";
import type { ConnectionState, Transport } from "./transport.js";

const TransportContext = createContext<Transport | undefined>(undefined);

/** Gives every component below it the transport of the host. */
export const TransportProvider = ({ transport, children }: { transport: Transport; children: ReactNode }) => (
  <TransportContext.Provider value={transport}>{children}</TransportContext.Provider>
);

export const useTransport = (): Transport => {
  const transport = useContext(TransportContext);
  if (transport === undefined) {
    throw new Error("useTransport needs a TransportProvider above it");
  }
  return transport;
};

/** The records of the transport; renders again when the set changes. */
export const useRecords = (): readonly Variant[] => {
  const transport = useTransport();
  return useSyncExternalStore(transport.subscribe, transport.records);
};

/** The host's sort; renders again when it changes. */
export const useSort = (): VariantSort => {
  const transport = useTransport();
  return useSyncExternalStore(transport.subscribe, transport.sort);
};

export const useConnectionState = (): ConnectionState => {
  const transport = useTransport();
  return useSyncExternalStore(transport.subscribe, transport.state);
};
