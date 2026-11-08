import { logD, logI, logT } from "../log.js";
import type { ListOptions, VariantRecord } from "../types.js";
import { collectRecords } from "./records.js";
import type { OperationContext } from "./types.js";

export const listVariants = async (context: OperationContext, options: ListOptions = {}): Promise<VariantRecord[]> => {
  if (!options.quiet) {
    logT("list");
    logD("listing variants");
  }
  const records = await collectRecords(context, options);
  if (!options.quiet) {
    logI("listed variants");
  }
  return records;
};
