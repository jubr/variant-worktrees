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

/** Template of the URL of a Vite instance. `{{slug}}`, `{{abbr}}` and `{{port}}` are placeholders. */
export const DEFAULT_URL = "http://{{slug}}.{{abbr}}.localhost:{{port}}";

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

/** The environment of an instance: the file copied for a variant, and the values for commands and that copy. */
export const InstanceEnvSchema = z.strictObject({
  /** Environment file relative to the instance directory, copied for a variant to `<worktree>/<dir>/<sourceFile>`. */
  sourceFile: relativeDirectory.optional(),
  /** Templated values for the instance's commands and, when it is created, the copy of `sourceFile`. */
  overrides: envMapSchema.optional(),
});
export type InstanceEnv = z.infer<typeof InstanceEnvSchema>;

/** Key of an instance: starts with a letter, then letters, digits, `-` and `_`. */
export const INSTANCE_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Key of the instance that `variant ui` records for itself in the runtime state of `main`; no project may define it. */
export const UI_INSTANCE_KEY = "variant-ui";

/** The segment of environment variables derived from an instance key: `my-api` becomes `MY_API`. */
export const envSegment = (key: string): string => key.toUpperCase().replace(/[^A-Z0-9]/g, "_");

/** The environment segment of the `variant.ui` settings: `VARIANT_UI_PORT` is `variant.ui.port`. No instance key may use it. */
export const UI_ENV_SEGMENT = "UI";

/** The environment override of `variant.ui.port`. */
export const UI_PORT_ENV = `VARIANT_${UI_ENV_SEGMENT}_PORT`;

/**
 * How an instance runs under `up`. Everything else about the container (base image, build, files, web server) is the
 * business of the Dockerfile.
 */
export const InstanceContainerSchema = z.strictObject({
  /** Relative to the worktree, built with the worktree as context. */
  dockerfile: z.string().min(1),
  /** Port inside the container; 80 when absent. */
  internalPort: PortSchema.optional(),
});
export type InstanceContainer = z.infer<typeof InstanceContainerSchema>;

export const VariantInstanceSchema = z.strictObject({
  kind: z.enum(["vite", "nestjs"]),
  dir: z.string().min(1),
  up: z.string().min(1).optional(),
  watch: z.string().min(1).optional(),
  /** URL template of the instance; `{{slug}}`, `{{abbr}}` and `{{port}}` are placeholders. */
  url: z.string().min(1).optional(),
  env: InstanceEnvSchema.optional(),
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

/** A step name: letters, digits, `-` and `_`, so that `VARIANT_STEP_<NAME>` can skip the step. */
const STEP_NAME = /^[A-Za-z0-9_-]+$/;
/** A project abbreviation: lowercase letters and digits, optionally separated by single hyphens. */
export const ABBR_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const VariantStepSchema = z.strictObject({
  name: z.string().regex(STEP_NAME, "must hold only letters, digits, - and _"),
  run: z.string().min(1),
  /** Relative to the worktree. */
  dir: relativeDirectory.optional(),
  env: envMapSchema.optional(),
  /** Regular expression: only matching output lines are printed. */
  filterLinesRegex: z
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
export const DEFAULT_STORAGE_ENV_VAR = "STORAGE_ROOT";
export const DEFAULT_MAX_DIFF_LINES = 200;

export const VariantStorageSchema = z.strictObject({
  dir: relativeDirectory.optional(),
  /** Name of the variable that carries the absolute storage directory. */
  envVarName: z.string().min(1).optional(),
});

export const VariantSuperviseSchema = z.strictObject({
  startDelaySeconds: seconds.optional(),
  readyTimeoutSeconds: seconds.optional(),
  /** 0 turns the check of the worktree off. */
  checkoutPollSeconds: seconds.optional(),
});

/** Settings of the `variant ui` server. The environment override of `variant.ui.<name>` is `VARIANT_UI_<NAME>`. */
export const VariantUiSchema = z.strictObject({
  /** Port the server listens on; `VARIANT_UI_PORT` wins. Absent: a free port that is not reserved. */
  port: PortSchema.optional(),
});

export const VariantImplodeSchema = z.strictObject({
  /**
   * Glob patterns of paths removed before the report: matched from the project directory and from each instance
   * directory; `{{slug}}` is replaced; tracked files stay.
   */
  preRm: z.array(relativeDirectory).optional(),
  /** Tracked files whose local modifications are discarded. */
  discard: z.array(plainName).optional(),
  requireMerged: z.boolean().optional(),
  maxDiffLines: z.number().int().nonnegative().optional(),
});

export const VariantRuntimeSchema = z
  .strictObject({
    /** The main git checkout the worktrees are made from; default: detected. */
    main: z.string().min(1).optional(),
    /** The directory that holds the worktrees; default: the directory of a parent `AGENTS.md` symlink, else `main`. */
    root: z.string().min(1).optional(),
    /** Short project label for hostnames and `{{abbr}}` in `open` templates. Derived from the checkout name when absent. */
    abbr: z
      .string()
      .regex(ABBR_PATTERN, "must be lowercase letters and digits, optionally separated by single -")
      .optional(),
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
    ui: VariantUiSchema.optional(),
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
    const stepSegments = new Map<string, string>();
    for (const [index, step] of (variant.steps ?? []).entries()) {
      if (names.has(step.name)) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "name"],
          message: `duplicate step name ${step.name}`,
        });
      }
      names.add(step.name);
      const segment = envSegment(step.name);
      const other = stepSegments.get(segment);
      if (other !== undefined && other !== step.name) {
        context.addIssue({
          code: "custom",
          path: ["steps", index, "name"],
          message: `steps ${other} and ${step.name} share the environment variable segment ${segment}`,
        });
      }
      stepSegments.set(segment, step.name);
    }
    const instances = variant.instances ?? {};
    if (UI_INSTANCE_KEY in instances) {
      context.addIssue({
        code: "custom",
        path: ["instances", UI_INSTANCE_KEY],
        message: `the instance key ${UI_INSTANCE_KEY} is reserved for the variant ui server`,
      });
    }
    const segments = new Map<string, string>();
    for (const key of Object.keys(instances)) {
      const segment = envSegment(key);
      if (segment === UI_ENV_SEGMENT) {
        context.addIssue({
          code: "custom",
          path: ["instances", key],
          message: `the instance key ${key} is reserved: its port variable ${UI_PORT_ENV} belongs to the variant ui server`,
        });
      }
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
  /** The log file of a detached `watch`: the output of all its processes. */
  log: z.string().min(1).optional(),
  db: RuntimeDbSchema.optional(),
  /** Keyed by the key of the entry in `variant.instances`. */
  instances: z.record(z.string().min(1), RuntimeInstanceSchema).optional(),
});
export type Runtime = z.infer<typeof RuntimeSchema>;
/** The runtime state as resolved: environment templates replaced, so the database port is a number. */
export type ResolvedRuntime = Omit<Runtime, "db"> & { db?: DbConfig };

export const LOCAL_FILENAME = "variants.local.yaml";

/** `variants.local.yaml`, git-ignored, next to variants.yaml in each variant's worktree. Other top-level keys are kept. */
export const VariantsLocalSchema = z.looseObject({ runtime: RuntimeSchema.optional() });
export type VariantsLocal = z.infer<typeof VariantsLocalSchema>;

/** `variant` as resolved by `loadConfig`: defaults applied, instances always a record. */
export type ResolvedVariant = Omit<
  VariantRuntime,
  | "main"
  | "root"
  | "abbr"
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
  main: string;
  root: string;
  abbr: string;
  prefix: string;
  instances: Record<string, VariantInstance>;
  baseBranch: string;
  branchPrefixes: string[];
  open: boolean;
  reservedPorts: number[];
  storage?: { dir: string; envVarName: string };
  supervise: { startDelaySeconds: number; readyTimeoutSeconds: number; checkoutPollSeconds: number };
  implode: {
    preRm: string[];
    discard: string[];
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
