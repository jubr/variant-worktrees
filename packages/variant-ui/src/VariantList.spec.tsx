import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { createMemoryTransport } from "./memory-transport.js";
import type { Variant } from "./model.js";
import { TransportProvider } from "./transport-context.js";
import { VariantList } from "./VariantList.js";

afterEach(cleanup);

const renderList = (records: Variant[]) => {
  const transport = createMemoryTransport(records);
  render(
    <TransportProvider transport={transport}>
      <VariantList />
    </TransportProvider>,
  );
  return transport;
};

const row = (slug: string): HTMLElement => screen.getByRole("listitem", { name: slug });
const iconOf = (element: HTMLElement): string[] =>
  [...element.querySelectorAll(".codicon")].flatMap((icon) => [...icon.classList].filter((name) => name !== "codicon"));

describe("variant rows", () => {
  it("shows a watching row with icon, label, URL and uptime", () => {
    renderList([
      {
        slug: "demo",
        mode: "watch",
        url: "http://demo.vw.localhost:62060",
        uptimeSeconds: 125,
        watches: { fe: { alive: true, url: "http://demo.vw.localhost:62060" } },
      },
    ]);

    const demo = row("demo");
    expect(within(demo).getByText("watching")).toBeTruthy();
    expect(iconOf(demo)).toContain("codicon-circle-filled");
    expect(within(demo).getByRole("link", { name: "http://demo.vw.localhost:62060" }).getAttribute("href")).toBe(
      "http://demo.vw.localhost:62060",
    );
    expect(within(demo).getByText("2m 5s")).toBeTruthy();
  });

  it("shows an up row", () => {
    renderList([{ slug: "demo", mode: "up", watches: { fe: { alive: true } } }]);

    expect(within(row("demo")).getByText("up")).toBeTruthy();
    expect(iconOf(row("demo"))).toContain("codicon-arrow-up");
  });

  it("shows a down row without a URL", () => {
    renderList([{ slug: "demo" }]);

    expect(within(row("demo")).getByText("down")).toBeTruthy();
    expect(iconOf(row("demo"))).toContain("codicon-circle-outline");
    expect(within(row("demo")).queryByRole("link")).toBeNull();
  });

  it("shows a record whose processes are all dead as down and stale", () => {
    renderList([{ slug: "demo", mode: "watch", watches: { fe: { alive: false } } }]);

    expect(within(row("demo")).getByText("down")).toBeTruthy();
    expect(within(row("demo")).getByText(/stale/)).toBeTruthy();
  });

  it("tells the three states apart by icon and label, not by colour alone", () => {
    renderList([
      { slug: "a", mode: "watch", watches: { fe: { alive: true } } },
      { slug: "b", mode: "up", watches: { fe: { alive: true } } },
      { slug: "c" },
    ]);

    const icons = ["a", "b", "c"].map((slug) => iconOf(row(slug)).join(" "));
    expect(new Set(icons).size).toBe(3);
    expect(["a", "b", "c"].map((slug) => within(row(slug)).getByTestId("state").textContent)).toEqual([
      "watching",
      "up",
      "down",
    ]);
  });

  it("lists variants by slug ascending when the host reports no other sort", () => {
    renderList([{ slug: "zeta" }, { slug: "main" }, { slug: "alpha" }]);

    expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("data-slug"))).toEqual([
      "main",
      "alpha",
      "zeta",
    ]);
  });

  it("reorders when the host changes the sort and keeps the UI server first", () => {
    const transport = renderList([
      { slug: "old", changedMs: 1 },
      {
        slug: "main",
        changedMs: 3,
        watches: { "variant-ui": { alive: true, url: "http://ui.vw.localhost:62100" } },
      },
      { slug: "new", changedMs: 5 },
    ]);

    act(() => transport.host.setSort("changed-desc"));

    expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("data-slug") ?? "ui-server")).toEqual([
      "ui-server",
      "main",
      "new",
      "old",
    ]);
  });

  it("does not invent a main row", () => {
    renderList([{ slug: "zeta" }, { slug: "alpha" }]);

    expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("data-slug"))).toEqual(["alpha", "zeta"]);
    expect(screen.queryByRole("listitem", { name: "main" })).toBeNull();
  });

  it("shows an empty state naming variant create when there are no records", () => {
    renderList([]);

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText(/variant create/)).toBeTruthy();
  });
});
