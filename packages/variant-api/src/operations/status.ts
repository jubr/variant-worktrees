import { DatabaseContactError } from "../db/failure.js";
import { resolveSlug } from "../slug.js";
import type { VariantRecord } from "../types.js";
import { collectRecords } from "./records.js";
import type { OperationContext } from "./types.js";

/** Everything known about one variant: its `list` record and all meta information of its runtime state. */
export const statusVariant = async (context: OperationContext, requestedSlug?: string): Promise<VariantRecord> => {
  const slug = resolveSlug(requestedSlug, context.cwd, context.config.variant.branchPrefixes, context.config.variant);
  const [record] = await collectRecords(context, { slug, verbose: true });
  if (!record) {
    if (context.contactWarning !== undefined) {
      throw new DatabaseContactError(context.contactWarning);
    }
    throw new Error(`Unknown variant: ${slug}`);
  }
  return record;
};
