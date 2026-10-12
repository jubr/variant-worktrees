import { ChatRenamerConfigSchema } from "chat-renamer-config/schema";
import { z } from "zod/v4";

export const DbDialectSchema = z.enum(["postgres", "mysql", "sqlite"]);
export type DbDialect = z.infer<typeof DbDialectSchema>;

export const DbConfigSchema = z.strictObject({
  dialect: DbDialectSchema.optional(),
  url: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().positive().optional(),
  user: z.string().min(1).optional(),
  password: z.string().optional(),
  database: z.string().min(1).optional(),
  schema: z.string().min(1).optional(),
  filename: z.string().min(1).optional(),
  ssl: z.boolean().optional(),
});
export type DbConfig = z.infer<typeof DbConfigSchema>;

export const VariantEntrySchema = z.strictObject({
  seed: z.string().min(1).optional(),
});
export type VariantEntry = z.infer<typeof VariantEntrySchema>;

/** Template of the URL that opens a Vite instance. `{{slug}}` and `{{port}}` are placeholders. */
export const DEFAULT_OPEN_URL = "http://{{slug}}.vw.localhost:{{port}}";

export const VariantInstanceSchema = z
  .strictObject({
    name: z.string().min(1).optional(),
    kind: z.enum(["vite", "nestjs"]),
    dir: z.string().min(1),
    up: z.string().min(1).optional(),
    watch: z.string().min(1).optional(),
    /** URL template to open the instance (Vite only); `{{slug}}` and `{{port}}` are placeholders. */
    open: z.string().min(1).optional(),
  })
  .superRefine((instance, context) => {
    if (instance.open !== undefined && instance.kind !== "vite") {
      context.addIssue({ code: "custom", path: ["open"], message: "open is only valid on a vite instance" });
    }
  });
export type VariantInstance = z.infer<typeof VariantInstanceSchema>;

/**
 * Prefix of every name derived from a variant slug: `<prefix><slug>`. It carries its own leading character and
 * connector, so worktree directories (and later database schemas and the like) are `_v-<slug>` by default.
 */
/** Default of `variant.cacheDir`, below the directory of variants.yaml. */
export const DEFAULT_CACHE_DIR = ".cache/variants";

export const DEFAULT_PREFIX = "_v-";

/** A prefix: non-empty, without a path separator. */
const prefixSchema = z
  .string()
  .min(1)
  .refine((value) => !/[\\/]/.test(value), "prefix must not contain a path separator");

export const VariantRuntimeSchema = z.strictObject({
  root: z.string().min(1).optional(),
  prefix: prefixSchema.optional(),
  up: z.string().min(1).optional(),
  watch: z.string().min(1).optional(),
  /** Command that seeds a new variant database. A per-variant `seed` wins. */
  seed: z.string().min(1).optional(),
  /** Directory of per-variant state files `<slug>.yaml`, relative to variants.yaml. Default `.cache/variants`. */
  cacheDir: z.string().min(1).optional(),
  instances: z.array(VariantInstanceSchema).optional(),
});
export type VariantRuntime = z.infer<typeof VariantRuntimeSchema>;

export const VariantsConfigSchema = z
  .strictObject({
    db: DbConfigSchema.optional(),
    variant: VariantRuntimeSchema.optional(),
    variants: z.record(z.string().min(1), VariantEntrySchema).optional(),
    /** Options of the Cursor chat renamer. The full set and its validation are owned by chat-renamer-config. */
    chatRenamer: ChatRenamerConfigSchema.optional(),
  })
  .superRefine((config, context) => {
    if (config.db && !config.db.url && config.db.dialect !== "sqlite" && !config.db.host) {
      context.addIssue({
        code: "custom",
        path: ["db", "host"],
        message: "db.host is required when db.url is absent and dialect is not sqlite",
      });
    }
  });
export type VariantsConfig = z.infer<typeof VariantsConfigSchema>;

export type ResolvedConfig = VariantsConfig & {
  db: DbConfig;
  configPath: string;
  configDir: string;
  source: "mise" | "env" | "config" | "default";
};

export const variantsJsonSchema = z.toJSONSchema(VariantsConfigSchema);
