import { createMemoryTransport } from "./memory-transport.js";
import { describeTransportContract } from "./testing/index.js";

describeTransportContract("memory", async (initial) => {
  const transport = createMemoryTransport(initial);
  let current = initial;
  return {
    transport,
    publish: (records) => {
      current = records;
      transport.host.publish(records);
    },
    disconnect: () => transport.host.setState("disconnected"),
    reconnect: () => {
      transport.host.publish(current);
      transport.host.setState("connected");
    },
    received: () => transport.host.received,
    failNext: transport.host.failNext,
    dispose: () => {},
  };
});
