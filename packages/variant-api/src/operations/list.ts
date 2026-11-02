import type { ListOptions, VariantRecord } from "../types.js";
import { collectRecords } from "./records.js";
import type { OperationContext } from "./types.js";

export const listVariants = (context: OperationContext, options: ListOptions = {}): Promise<VariantRecord[]> =>
  collectRecords(context, options);
