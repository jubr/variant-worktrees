import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryTransport } from "./memory-transport.js";
import { chooseTransport, Root } from "./Root.js";

afterEach(cleanup);

describe("transport choice", () => {
  it("uses the editor's message channel inside a webview", () => {
    const posted: unknown[] = [];

    const transport = chooseTransport(
      { postMessage: (message) => posted.push(message) },
      () => () => {},
      () => {},
    );

    expect(transport.origin).toBe("editor");
    expect(posted).toEqual([{ type: "ready" }]);
  });

  it("uses the server's HTTP API in a browser", () => {
    const transport = chooseTransport(
      undefined,
      () => () => {},
      () => {},
    );

    expect(transport.origin).toBe("server");
    (transport as { close?: () => void }).close?.();
  });
});

describe("output dialog", () => {
  it("shows the output the transport reports, and closes", () => {
    let report: (slug: string, text: string) => void = () => {};
    render(
      <Root
        build={(onOutput) => {
          report = onOutput;
          return createMemoryTransport([{ slug: "demo" }]);
        }}
      />,
    );

    act(() => report("demo", "listening on 3000"));

    expect(screen.getByRole("dialog", { name: "Output of demo" }).textContent).toContain("listening on 3000");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
