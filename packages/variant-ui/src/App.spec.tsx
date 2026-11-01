import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { App } from "./App.js";
import { createMemoryTransport } from "./memory-transport.js";
import type { Variant } from "./model.js";
import { TransportProvider } from "./transport-context.js";

afterEach(cleanup);

const renderApp = (records: Variant[], origin: "editor" | "server" = "editor") => {
  const transport = createMemoryTransport(records, origin);
  render(
    <TransportProvider transport={transport}>
      <App />
    </TransportProvider>,
  );
  return transport;
};

const row = (slug: string): HTMLElement => screen.getByRole("listitem", { name: slug });
const control = (slug: string, name: string): HTMLButtonElement =>
  within(row(slug)).getByRole("button", { name: `${name} ${slug}` }) as HTMLButtonElement;

const watching: Variant = { slug: "demo", mode: "watch", instances: { fe: { alive: true } } };
const up: Variant = { slug: "demo", mode: "up", instances: { fe: { alive: true } } };
const down: Variant = { slug: "demo" };

describe("controls per state", () => {
  it("enables play and implode, and disables stop, for a down variant", () => {
    renderApp([down]);

    expect(control("demo", "Play").disabled).toBe(false);
    expect(control("demo", "Implode").disabled).toBe(false);
    expect(control("demo", "Stop").disabled).toBe(true);
  });

  it("enables stop and implode, and disables play, for a watching variant", () => {
    renderApp([watching]);

    expect(control("demo", "Stop").disabled).toBe(false);
    expect(control("demo", "Implode").disabled).toBe(false);
    expect(control("demo", "Play").disabled).toBe(true);
  });

  it("enables play, stop and implode for an up variant", () => {
    renderApp([up]);

    for (const name of ["Play", "Stop", "Implode"]) {
      expect(control("demo", name).disabled).toBe(false);
    }
  });

  it("gives main no implode control", () => {
    renderApp([{ slug: "main" }]);

    expect(within(row("main")).queryByRole("button", { name: "Implode main" })).toBeNull();
    expect(control("main", "Play")).toBeTruthy();
  });

  it("starts a watch when play is pressed and brings the variant down when stop is pressed", async () => {
    const transport = renderApp([up]);

    fireEvent.click(control("demo", "Play"));
    await waitFor(() => expect(control("demo", "Stop").disabled).toBe(false));
    fireEvent.click(control("demo", "Stop"));

    await waitFor(() =>
      expect(transport.host.received).toEqual([
        { action: "watch", slug: "demo" },
        { action: "down", slug: "demo" },
      ]),
    );
  });
});

describe("pending action", () => {
  it("disables every control of the row and shows a busy indicator until it settles, leaving other rows alone", async () => {
    const transport = renderApp([down, { slug: "other" }]);
    const held = transport.host.hold();

    fireEvent.click(control("demo", "Play"));

    await waitFor(() => expect(control("demo", "Play").disabled).toBe(true));
    for (const name of ["Play", "Stop", "Implode"]) {
      expect(control("demo", name).disabled).toBe(true);
    }
    expect(within(row("demo")).getByRole("status", { name: "Working" })).toBeTruthy();
    expect(control("other", "Play").disabled).toBe(false);
    expect(within(row("other")).queryByRole("status")).toBeNull();

    await act(async () => held.release());

    await waitFor(() => expect(control("demo", "Play").disabled).toBe(false));
    expect(within(row("demo")).queryByRole("status")).toBeNull();
  });
});

describe("failing action", () => {
  it("shows the message on the row and keeps the row's state", async () => {
    const transport = renderApp([watching]);
    transport.host.failNext("Variant demo is not merged into main");

    fireEvent.click(control("demo", "Implode"));
    fireEvent.click(screen.getByRole("button", { name: "Implode demo permanently" }));

    const alert = await within(row("demo")).findByRole("alert");
    expect(alert.textContent).toContain("Variant demo is not merged into main");
    expect(within(row("demo")).getByTestId("state").textContent).toBe("watching");
    expect(control("demo", "Stop").disabled).toBe(false);
  });
});

describe("implode confirmation", () => {
  it("names the variant and what is removed, and implodes with confirm only after acceptance", async () => {
    const transport = renderApp([down]);

    fireEvent.click(control("demo", "Implode"));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("demo");
    expect(dialog.textContent).toMatch(/database target/);
    expect(dialog.textContent).toMatch(/worktree/);
    expect(transport.host.received).toEqual([]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Implode demo permanently" }));

    await waitFor(() => expect(transport.host.received).toEqual([{ action: "implode", slug: "demo", confirm: true }]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does nothing when the person cancels", () => {
    const transport = renderApp([down]);

    fireEvent.click(control("demo", "Implode"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(transport.host.received).toEqual([]);
  });

  it("does nothing when the dialog is dismissed with Escape", () => {
    const transport = renderApp([down]);

    fireEvent.click(control("demo", "Implode"));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(transport.host.received).toEqual([]);
  });
});

describe("UI server row", () => {
  const server: Variant = {
    slug: "main",
    instances: { "variant-ui": { port: 62100, pid: 7, alive: true, url: "http://ui.vw.localhost:62100" } },
  };

  it("shows the URL with open and stop controls in the editor, and stop brings the server down", async () => {
    const transport = renderApp([server, { slug: "demo" }], "editor");

    const uiRow = screen.getByRole("listitem", { name: "UI server" });
    expect(within(uiRow).getByRole("link", { name: "http://ui.vw.localhost:62100" })).toBeTruthy();
    fireEvent.click(within(uiRow).getByRole("button", { name: "Stop UI server" }));

    await waitFor(() => expect(transport.host.received).toEqual([{ action: "down", slug: "variant-ui" }]));
    expect(screen.getAllByRole("listitem")[0]).toBe(uiRow);
  });

  it("shows the URL but no stop control in the page the server itself serves", () => {
    renderApp([server], "server");

    const uiRow = screen.getByRole("listitem", { name: "UI server" });
    expect(within(uiRow).getByRole("link", { name: "http://ui.vw.localhost:62100" })).toBeTruthy();
    expect(within(uiRow).queryByRole("button")).toBeNull();
  });

  it("shows no UI server row without the instance, and is not a variant row of its own", () => {
    renderApp([{ slug: "main" }]);

    expect(screen.queryByRole("listitem", { name: "UI server" })).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("show output", () => {
  it("is enabled with a log and calls showOutput", async () => {
    const transport = renderApp([{ slug: "demo", log: "/work/_v-demo/variants.watch.log" }]);

    fireEvent.click(control("demo", "Show output of"));
    await waitFor(() => expect(transport.host.received).toEqual([{ action: "showOutput", slug: "demo" }]));
  });

  it("is disabled without a log", () => {
    renderApp([down]);

    expect(control("demo", "Show output of").disabled).toBe(true);
  });
});

describe("connection state", () => {
  it("keeps stale rows, shows a notice and disables every control while disconnected, and recovers on reconnect", () => {
    const transport = renderApp([watching, { slug: "main" }]);

    act(() => transport.host.setState("disconnected"));

    expect(screen.getByRole("alert").textContent).toMatch(/disconnected/i);
    expect(row("demo")).toBeTruthy();
    for (const slug of ["demo", "main"]) {
      for (const button of within(row(slug)).getAllByRole("button")) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    }

    act(() => {
      transport.host.publish([down]);
      transport.host.setState("connected");
    });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(row("demo")).getByTestId("state").textContent).toBe("down");
    expect(control("demo", "Play").disabled).toBe(false);
  });
});
