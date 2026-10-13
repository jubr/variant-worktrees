import { relative } from "node:path";
import type { VariantRecord } from "./types.js";

const COLUMNS = ["slug", "dir", "url", "schema"] as const;

/** One row per variant, sorted by slug: slug, directory (relative to the variant root), URL and database target. */
export const formatTable = (records: readonly VariantRecord[], variantRoot: string): string => {
  const rows = [...records]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((record) => [
      record.slug,
      record.worktree ? relative(variantRoot, record.worktree) || "." : "-",
      record.url ?? "-",
      record.target || "-",
    ]);
  const table = [[...COLUMNS], ...rows];
  const widths = COLUMNS.map((_, column) => Math.max(...table.map((row) => (row[column] as string).length)));
  return table
    .map((row) =>
      row
        .map((cell, column) => cell.padEnd(widths[column] as number))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
};
