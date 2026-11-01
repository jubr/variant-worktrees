import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createMemoryTransport } from "./memory-transport.js";
import { TransportProvider, useConnectionState, useRecords } from "./transport-context.js";

afterEach(cleanup);

const Probe = () => {
  const records = useRecords();
  const state = useConnectionState();
  return (
    <p>
      {state}: {records.map((variant) => variant.slug).join(",")}
    </p>
  );
};

describe("transport context", () => {
  it("renders the records and connection state of the transport and follows their changes", () => {
    const transport = createMemoryTransport([{ slug: "demo" }]);
    render(
      <TransportProvider transport={transport}>
        <Probe />
      </TransportProvider>,
    );
    expect(screen.getByText("connected: demo")).toBeTruthy();

    act(() => transport.host.publish([{ slug: "demo" }, { slug: "other" }]));
    expect(screen.getByText("connected: demo,other")).toBeTruthy();

    act(() => transport.host.setState("disconnected"));
    expect(screen.getByText("disconnected: demo,other")).toBeTruthy();
  });

  it("fails without a transport provider", () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Probe />)).toThrow("TransportProvider");
    } finally {
      console.error = quiet;
    }
  });
});
