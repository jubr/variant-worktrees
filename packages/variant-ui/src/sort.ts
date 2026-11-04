/** The orders the Variants view and the panel share. A missing or unknown value is `name-asc`. */
export const VARIANT_SORTS = [
  "name-asc",
  "name-desc",
  "created-asc",
  "created-desc",
  "changed-asc",
  "changed-desc",
] as const;

export type VariantSort = (typeof VARIANT_SORTS)[number];

export const variantSort = (value: unknown): VariantSort =>
  typeof value === "string" && (VARIANT_SORTS as readonly string[]).includes(value)
    ? (value as VariantSort)
    : "name-asc";

export interface SortableVariant {
  slug: string;
  createdMs?: number;
  changedMs?: number;
}

const timeOf = (record: SortableVariant, field: "created" | "changed"): number => {
  const time = field === "created" ? record.createdMs : record.changedMs;
  return time ?? Number.NEGATIVE_INFINITY;
};

/** Smaller first when ascending. A missing time is older than every known time. Ties break by slug, ascending. `main` stays first. */
export const sortVariants = <T extends SortableVariant>(records: readonly T[], sort: VariantSort): T[] => {
  const [field, direction] = sort.split("-") as ["name" | "created" | "changed", "asc" | "desc"];
  const sign = direction === "asc" ? 1 : -1;
  const ordered = [...records].sort((left, right) => {
    const primary = field === "name" ? left.slug.localeCompare(right.slug) : timeOf(left, field) - timeOf(right, field);
    if (primary !== 0) {
      return primary * sign;
    }
    return left.slug.localeCompare(right.slug);
  });
  return [...ordered.filter((record) => record.slug === "main"), ...ordered.filter((record) => record.slug !== "main")];
};
