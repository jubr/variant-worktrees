import { log } from "../log.js";
import type { ListOptions, VariantRecord } from "../types.js";
import { collectRecords } from "./records.js";
import type { OperationContext } from "./types.js";

export const listVariants = async (context: OperationContext, options: ListOptions = {}): Promise<VariantRecord[]> => {
  if (!options.quiet) {
    log("trace", "list");
    log("debug", "listing variants");
  }
  const records = await collectRecords(context, options);
  if (!options.quiet) {
    log("info", "listed variants");
  }
  return records;
};
