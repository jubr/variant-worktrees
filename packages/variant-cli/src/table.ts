import { relative } from "node:path";
import type { VariantRecord } from "variant-api";
import { formatDuration } from "./duration.js";

const COLUMNS = ["slug", "mode", "uptime", "url", "log", "dir"] as const;

/**
 * One row per variant, sorted by slug: slug, mode, uptime, the full URL, the log file of its detached watch (absolute) and
 * its directory (relative to the variant root). `-` stands for what a variant does not have.
 */
export const formatTable = (records: readonly VariantRecord[], variantRoot: string): string => {
  const rows = [...records]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((record) => [
      record.slug,
      record.mode ?? "-",
      record.uptimeSeconds === undefined ? "-" : formatDuration(record.uptimeSeconds),
      record.url ?? "-",
      record.log ?? "-",
      record.worktree ? relative(variantRoot, record.worktree) || "." : "-",
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
