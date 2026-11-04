import { describe, expect, it } from "bun:test";
import { sortVariants, type VariantSort } from "./sort.js";

const rows = [
  { slug: "zeta", createdMs: 30, changedMs: 10 },
  { slug: "main", createdMs: 20, changedMs: 30 },
  { slug: "alpha", createdMs: 10, changedMs: 20 },
  { slug: "none" },
];

const slugs = (sort: VariantSort): string[] => sortVariants(rows, sort).map((row) => row.slug);

describe("variant sort", () => {
  it("orders by slug, with a missing sort meaning ascending, and pins main first", () => {
    expect(slugs("name-asc")).toEqual(["main", "alpha", "none", "zeta"]);
    expect(slugs("name-desc")).toEqual(["main", "zeta", "none", "alpha"]);
  });

  it("treats a missing time as older than every known time and still pins main", () => {
    expect(slugs("created-asc")).toEqual(["main", "none", "alpha", "zeta"]);
    expect(slugs("created-desc")).toEqual(["main", "zeta", "alpha", "none"]);
    expect(slugs("changed-asc")).toEqual(["main", "none", "zeta", "alpha"]);
    expect(slugs("changed-desc")).toEqual(["main", "alpha", "zeta", "none"]);
  });

  it("does not invent a main row", () => {
    expect(sortVariants([{ slug: "zeta" }, { slug: "alpha" }], "name-asc").map((row) => row.slug)).toEqual([
      "alpha",
      "zeta",
    ]);
  });

  it("breaks a tie by slug ascending", () => {
    const tied = [
      { slug: "beta", createdMs: 5 },
      { slug: "alpha", createdMs: 5 },
    ];

    expect(sortVariants(tied, "created-desc").map((row) => row.slug)).toEqual(["alpha", "beta"]);
  });
});
