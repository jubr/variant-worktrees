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
  it("orders by slug, with a missing sort meaning ascending", () => {
    expect(slugs("name-asc")).toEqual(["alpha", "main", "none", "zeta"]);
    expect(slugs("name-desc")).toEqual(["zeta", "none", "main", "alpha"]);
  });

  it("treats a missing time as older than every known time", () => {
    expect(slugs("created-asc")).toEqual(["none", "alpha", "main", "zeta"]);
    expect(slugs("created-desc")).toEqual(["zeta", "main", "alpha", "none"]);
    expect(slugs("changed-asc")).toEqual(["none", "zeta", "alpha", "main"]);
    expect(slugs("changed-desc")).toEqual(["main", "alpha", "zeta", "none"]);
  });

  it("breaks a tie by slug ascending", () => {
    const tied = [
      { slug: "beta", createdMs: 5 },
      { slug: "alpha", createdMs: 5 },
    ];

    expect(sortVariants(tied, "created-desc").map((row) => row.slug)).toEqual(["alpha", "beta"]);
  });
});
