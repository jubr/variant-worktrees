import { ChatRenamerConfigSchema } from "chat-renamer-config/schema";
import { z } from "zod/v4";

export const DbDialectSchema = z.enum(["postgres", "mysql", "sqlite"]);
export type DbDialect = z.infer<typeof DbDialectSchema>;

/** A TCP port: shared by the database settings and the runtime state of instances. */
export const PortSchema = z.number().int().positive();

export const DbConfigSchema = z.strictObject({
  dialect: DbDialectSchema.optional(),
  url: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
  port: PortSchema.optional(),
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

export const VariantInstanceSchema = z.strictObject({
  name: z.string().min(1).optional(),
  kind: z.enum(["vite", "nestjs"]),
  dir: z.string().min(1),
  up: z.string().min(1).optional(),
  watch: z.string().min(1).optional(),
  /** URL template to open the instance; `{{slug}}` and `{{port}}` are placeholders. */
  open: z.string().min(1).optional(),
  /** Environment file, relative to `dir`, that is copied for a variant and amended with that variant's values. */
  dotenv: z.string().min(1).optional(),
});
export type VariantInstance = z.infer<typeof VariantInstanceSchema>;

/**
 * Prefix of every name derived from a variant slug: `<prefix><slug>`. It carries its own leading character and
 * connector, so worktree directories (and later database schemas and the like) are `_v-<slug>` by default.
 */
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

/** A port written literally, or as a `{{NAME}}` template that is replaced from the environment when the file is read. */
const portOrTemplateSchema = z.union([PortSchema, z.string().regex(/^(\d+|\{\{[A-Za-z_][A-Za-z0-9_]*\}\})$/)]);

/** The database settings of a running variant: `db`, except that the port may be an environment template. */
export const RuntimeDbSchema = DbConfigSchema.extend({ port: portOrTemplateSchema.optional() });

/** What is known about one running instance of a variant. */
export const RuntimeInstanceSchema = z.strictObject({
  port: PortSchema.optional(),
  pid: z.number().int().positive().optional(),
  url: z.string().min(1).optional(),
});

/** Ephemeral state of one variant, written into the variant's own worktree. */
export const RuntimeSchema = z.strictObject({
  slug: z.string().min(1).optional(),
  mode: z.enum(["up", "watch"]).optional(),
  dir: z.string().min(1).optional(),
  db: RuntimeDbSchema.optional(),
  /** Keyed by instance name; an unnamed instance is keyed by its kind. */
  instances: z.record(z.string().min(1), RuntimeInstanceSchema).optional(),
});
export type Runtime = z.infer<typeof RuntimeSchema>;
/** The runtime state as resolved: environment templates replaced, so the database port is a number. */
export type ResolvedRuntime = Omit<Runtime, "db"> & { db?: DbConfig };

export const LOCAL_FILENAME = "variants.local.yaml";

/** `variants.local.yaml`, git-ignored, next to variants.yaml in each variant's worktree. */
export const VariantsLocalSchema = z.strictObject({ runtime: RuntimeSchema.optional() });
export type VariantsLocal = z.infer<typeof VariantsLocalSchema>;

export type ResolvedConfig = VariantsConfig & {
  db: DbConfig;
  configPath: string;
  configDir: string;
  runtime?: ResolvedRuntime;
  source: "mise" | "env" | "config" | "default";
};

export const variantsJsonSchema = z.toJSONSchema(VariantsConfigSchema);
export const variantsLocalJsonSchema = z.toJSONSchema(VariantsLocalSchema);
