import { isAbsolute } from "node:path";
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

/** A relative path that stays below its base directory: not absolute, never `..`. */
const insideDirectory = (value: string): boolean => !isAbsolute(value) && !value.split(/[\\/]/).includes("..");
const relativeDirectory = z.string().min(1).refine(insideDirectory, "must be relative and stay inside the worktree");

/** A file or directory name: no path separator, not `.` or `..`. */
const plainName = z
  .string()
  .min(1)
  .refine((value) => !/[\\/]/.test(value) && value !== "." && value !== "..", "must be a plain name");

/** A map of environment variable names to templated values. */
const envMapSchema = z.record(z.string().min(1), z.string());

/** Key of an instance: starts with a letter, then letters, digits, `-` and `_`. */
export const INSTANCE_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** The segment of environment variables derived from an instance key: `my-api` becomes `MY_API`. */
export const envSegment = (key: string): string => key.toUpperCase().replace(/[^A-Z0-9]/g, "_");

/** How an instance runs under `up`. */
export const InstanceContainerSchema = z
  .strictObject({
    image: z.string().min(1).optional(),
    /** Relative to the worktree, built with the worktree as context. */
    dockerfile: z.string().min(1).optional(),
    /** Shell command that runs in the instance directory before the container starts. */
    build: z.string().min(1).optional(),
    /** Directory, relative to the instance directory, whose files are served by nginx. */
    static: z.string().min(1).optional(),
    /** Port inside the container; 80 for a static site. */
    port: PortSchema.optional(),
    /** Forwards requests below `path` to the instance with the key `to`. */
    proxy: z
      .strictObject({
        path: z.string().regex(/^\/(.*\/)?$/, "must start and end with /"),
        to: z.string().min(1),
      })
      .optional(),
    /** `host:container` mounts, templated. */
    volumes: z.array(z.string().min(1)).optional(),
    env: envMapSchema.optional(),
  })
  .superRefine((container, context) => {
    if (container.static === undefined && container.image === undefined && container.dockerfile === undefined) {
      context.addIssue({ code: "custom", message: "a container without static needs image or dockerfile" });
    }
    if (container.static === undefined && container.port === undefined) {
      context.addIssue({ code: "custom", path: ["port"], message: "a container without static needs port" });
    }
  });
export type InstanceContainer = z.infer<typeof InstanceContainerSchema>;

export const VariantInstanceSchema = z.strictObject({
  kind: z.enum(["vite", "nestjs"]),
  dir: z.string().min(1),
  up: z.string().min(1).optional(),
  watch: z.string().min(1).optional(),
  /** URL template to open the instance; `{{slug}}` and `{{port}}` are placeholders. */
  open: z.string().min(1).optional(),
  /** Environment file, relative to `dir`, that is copied for a variant and amended with that variant's values. */
  dotenv: z.string().min(1).optional(),
  /** Values for the instance's commands and its dotenv copy when the copy is created. Templated. */
  env: envMapSchema.optional(),
  /** Like `env`, and written into the dotenv copy again on every run. Templated. */
  envAlways: envMapSchema.optional(),
  /** Environment file that is copied instead of the primary worktree's. Absolute, or relative to the primary worktree. */
  dotenvSource: z.string().min(1).optional(),
  /** Shell command that runs in `dir` when `dir` has no `node_modules`. */
  install: z.string().min(1).optional(),
  /** URL path that answers with a success status when the instance serves. */
  ready: z.string().startsWith("/").optional(),
  container: InstanceContainerSchema.optional(),
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

const seconds = z.number().int().nonnegative();

export const VariantStepSchema = z.strictObject({
  name: z.string().min(1),
  run: z.string().min(1),
  /** Relative to the worktree. */
  dir: relativeDirectory.optional(),
  env: envMapSchema.optional(),
  /** The step is skipped when every named variable has the given value. */
  unlessEnv: z.record(z.string().min(1), z.string()).optional(),
  /** Regular expression: only matching output lines are printed. */
  show: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        new RegExp(value);
        return true;
      } catch {
        return false;
      }
    }, "must be a valid regular expression")
    .optional(),
});
export type VariantStep = z.infer<typeof VariantStepSchema>;

export const DEFAULT_BASE_BRANCH = "main";
export const DEFAULT_BRANCH_PREFIXES: readonly string[] = ["feat/", "fix/"];
export const DEFAULT_RESERVED_PORTS: readonly number[] = [3000, 4200, 5432];
export const DEFAULT_STORAGE_DIR = ".storage";
export const DEFAULT_STORAGE_ENV = "STORAGE_ROOT";
export const DEFAULT_MAX_DIFF_LINES = 200;

export const VariantStorageSchema = z.strictObject({
  dir: relativeDirectory.optional(),
  env: z.string().min(1).optional(),
});

export const VariantSuperviseSchema = z.strictObject({
  startDelaySeconds: seconds.optional(),
  readyTimeoutSeconds: seconds.optional(),
  /** 0 turns the check of the worktree off. */
  checkoutPollSeconds: seconds.optional(),
});

export const VariantImplodeSchema = z.strictObject({
  /** Directory names removed below each instance directory before the worktree is removed. */
  preRm: z.array(plainName).optional(),
  /** Tracked files whose local modifications are discarded. */
  restore: z.array(plainName).optional(),
  /** Glob patterns of untracked files to delete; `{{slug}}` is replaced. */
  untracked: z.array(z.string().min(1)).optional(),
  requireMerged: z.boolean().optional(),
  maxDiffLines: z.number().int().nonnegative().optional(),
});

export const VariantRuntimeSchema = z
  .strictObject({
    root: z.string().min(1).optional(),
    prefix: prefixSchema.optional(),
    /** Branch that new variant branches start from, and that a variant is merged into before it is imploded. */
    baseBranch: z.string().min(1).optional(),
    /** The first prefixes a new branch; all of them are removed when a slug is derived from a branch. */
    branchPrefixes: z.array(z.string().min(2).endsWith("/")).min(1).optional(),
    containerEngine: z.enum(["docker", "podman"]).optional(),
    /** Whether URLs are opened in the browser. `VARIANT_OPEN=0` wins. */
    open: z.boolean().optional(),
    /** Ports that are never picked for an instance. */
    reservedPorts: z.array(PortSchema).optional(),
    storage: VariantStorageSchema.optional(),
    steps: z.array(VariantStepSchema).optional(),
    supervise: VariantSuperviseSchema.optional(),
    implode: VariantImplodeSchema.optional(),
    up: z.string().min(1).optional(),
    watch: z.string().min(1).optional(),
    /** Command that seeds a new variant database. A per-variant `seed` wins. */
    seed: z.string().min(1).optional(),
    /** Keyed by instance name; the key is the name in runtime state, templates and environment variables. */
    instances: z
      .record(
        z.string().regex(INSTANCE_KEY, "must start with a letter and hold letters, digits, - and _"),
        VariantInstanceSchema,
      )
      .optional(),
  })
  .superRefine((variant, context) => {
    const names = new Set<string>();
    for (const [index, step] of (variant.steps ?? []).entries()) {
      if (names.has(step.name)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "name"],
          message: `duplicate step name ${step.name}`,
        });
      }
      names.add(step.name);
    }
    const instances = variant.instances ?? {};
    const segments = new Map<string, string>();
    for (const key of Object.keys(instances)) {
      const segment = envSegment(key);
      const other = segments.get(segment);
      if (other !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["instances", key],
          message: `instances ${other} and ${key} share the environment variable segment ${segment}`,
        });
      }
      segments.set(segment, key);
    }
    for (const [key, instance] of Object.entries(instances)) {
      const target = instance.container?.proxy?.to;
      if (target !== undefined && instances[target]?.container?.port === undefined) {
        context.addIssue({
          code: "custom",
          path: ["instances", key, "container", "proxy", "to"],
          message: `proxy target ${target} is not an instance with container.port`,
        });
      }
    }
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
export type RuntimeInstance = z.infer<typeof RuntimeInstanceSchema>;

/** Ephemeral state of one variant, written into the variant's own worktree. */
export const RuntimeSchema = z.strictObject({
  slug: z.string().min(1).optional(),
  mode: z.enum(["up", "watch"]).optional(),
  dir: z.string().min(1).optional(),
  db: RuntimeDbSchema.optional(),
  /** Keyed by the key of the entry in `variant.instances`. */
  instances: z.record(z.string().min(1), RuntimeInstanceSchema).optional(),
});
export type Runtime = z.infer<typeof RuntimeSchema>;
/** The runtime state as resolved: environment templates replaced, so the database port is a number. */
export type ResolvedRuntime = Omit<Runtime, "db"> & { db?: DbConfig };

export const LOCAL_FILENAME = "variants.local.yaml";

/** `variants.local.yaml`, git-ignored, next to variants.yaml in each variant's worktree. */
export const VariantsLocalSchema = z.strictObject({ runtime: RuntimeSchema.optional() });
export type VariantsLocal = z.infer<typeof VariantsLocalSchema>;

/** `variant` as resolved by `loadConfig`: defaults applied, instances always a record. */
export type ResolvedVariant = Omit<
  VariantRuntime,
  | "root"
  | "prefix"
  | "instances"
  | "baseBranch"
  | "branchPrefixes"
  | "open"
  | "reservedPorts"
  | "storage"
  | "supervise"
  | "implode"
> & {
  root: string;
  prefix: string;
  instances: Record<string, VariantInstance>;
  baseBranch: string;
  branchPrefixes: string[];
  open: boolean;
  reservedPorts: number[];
  storage?: { dir: string; env: string };
  supervise: { startDelaySeconds: number; readyTimeoutSeconds: number; checkoutPollSeconds: number };
  implode: {
    preRm: string[];
    restore: string[];
    untracked: string[];
    requireMerged: boolean;
    maxDiffLines: number;
  };
};

export type ResolvedConfig = Omit<VariantsConfig, "variant"> & {
  variant: ResolvedVariant;
  db: DbConfig;
  configPath: string;
  configDir: string;
  runtime?: ResolvedRuntime;
  source: "mise" | "env" | "config" | "default";
};

export const variantsJsonSchema = z.toJSONSchema(VariantsConfigSchema);
export const variantsLocalJsonSchema = z.toJSONSchema(VariantsLocalSchema);
