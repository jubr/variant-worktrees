import { isAbsolute } from "node:path";
import { ChatRenamerConfigSchema } from "chat-renamer-config/schema";
import { z } from "zod/v4";

export const DbDialectSchema = z.enum(["postgres", "mysql", "sqlite"]);
export type DbDialect = z.infer<typeof DbDialectSchema>;

/** A TCP port: shared by the database settings and the runtime state of watches. */
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

/** Template of the URL of a Vite watch. `{{slug}}`, `{{abbr}}` and `{{port}}` are placeholders. */
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

/** The environment of a watch: the file copied for a variant, and the values for commands and that copy. */
export const WatchEnvSchema = z.strictObject({
  /** Environment file relative to the watch directory, copied for a variant to `<worktree>/<dir>/<sourceFile>`. */
  sourceFile: relativeDirectory.optional(),
  /** Templated values for the watch's commands and, when it is created, the copy of `sourceFile`. */
  overrides: envMapSchema.optional(),
});
export type WatchEnv = z.infer<typeof WatchEnvSchema>;

/** Key of a watch: starts with a letter, then letters, digits, `-` and `_`. */
export const WATCH_KEY = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Key of the watch that `variant ui` records for itself in the runtime state of `main`; no project may define it. */
export const UI_WATCH_KEY = "variant-ui";

/** The segment of environment variables derived from a watch key: `my-api` becomes `MY_API`. */
export const envSegment = (key: string): string => key.toUpperCase().replace(/[^A-Z0-9]/g, "_");

/** The environment segment of the `variant.ui` settings: `VARIANT_UI_PORT` is `variant.ui.port`. No watch key may use it. */
export const UI_ENV_SEGMENT = "UI";

/** The environment override of `variant.ui.port`. */
export const UI_PORT_ENV = `VARIANT_${UI_ENV_SEGMENT}_PORT`;

/**
 * How a watch runs under `up`. Everything else about the container (base image, build, files, web server) is the
 * business of the Dockerfile.
 */
export const WatchContainerSchema = z.strictObject({
  /** Relative to the worktree, built with the worktree as context. */
  dockerfile: z.string().min(1),
  /** Port inside the container; 80 when absent. */
  internalPort: PortSchema.optional(),
});
export type WatchContainer = z.infer<typeof WatchContainerSchema>;

export const VariantWatchSchema = z.strictObject({
  /** What the watch runs; only a label (autodetection sets it and names a root-level watch after it). */
  kind: z.enum(["vite", "nestjs"]).optional(),
  /** Relative to the worktree; the key of the watch when absent. */
  dir: z.string().min(1).optional(),
  up: z.string().min(1).optional(),
  watch: z.string().min(1).optional(),
  /** URL template of the watch; `{{slug}}`, `{{abbr}}` and `{{port}}` are placeholders. */
  url: z.string().min(1).optional(),
  env: WatchEnvSchema.optional(),
  /** Shell command that runs in `dir` when `dir` has no `node_modules`. */
  install: z.string().min(1).optional(),
  /** URL path that answers with a success status when the watch serves. */
  ready: z.string().startsWith("/").optional(),
  container: WatchContainerSchema.optional(),
});
/** A watch as written in `variants.yaml`: `dir` may be absent. */
export type VariantWatchConfig = z.infer<typeof VariantWatchSchema>;
/** A watch as resolved: `dir` is always set. */
export type VariantWatch = Omit<VariantWatchConfig, "dir"> & { dir: string };

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
/** The range of ports that free ports of watches and of the `variant ui` server are picked from. */
export const DEFAULT_PORT_RANGE = "42000-42999";
const PORT_RANGE = /^(\d+)-(\d+)$/;
const LOWEST_RANGE_PORT = 1024;
const HIGHEST_RANGE_PORT = 65535;

export interface PortRange {
  low: number;
  high: number;
}

/** `<low>-<high>` as numbers; nothing when it is not of that form or an end is outside 1024 to 65535 or low exceeds high. */
export const parsePortRange = (range: string): PortRange | undefined => {
  const match = PORT_RANGE.exec(range);
  if (!match) {
    return undefined;
  }
  const low = Number(match[1]);
  const high = Number(match[2]);
  const inside = (port: number): boolean => port >= LOWEST_RANGE_PORT && port <= HIGHEST_RANGE_PORT;
  return inside(low) && inside(high) && low <= high ? { low, high } : undefined;
};

export const VariantPortsSchema = z.strictObject({
  /** `<low>-<high>`, both ends from 1024 to 65535; default `42000-42999`. */
  range: z
    .string()
    .refine(
      (value) => parsePortRange(value) !== undefined,
      "must be <low>-<high>, both from 1024 to 65535, low not above high",
    )
    .optional(),
});
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
  /** Port the server listens on; `VARIANT_UI_PORT` wins. Absent: a free port of `variant.ports.range`. */
  port: PortSchema.optional(),
});

export const VariantImplodeSchema = z.strictObject({
  /**
   * Glob patterns of paths removed before the report: matched from the project directory and from each watch
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
    /** The range free ports are picked from; no port is reserved. */
    ports: VariantPortsSchema.optional(),
    storage: VariantStorageSchema.optional(),
    steps: z.array(VariantStepSchema).optional(),
    supervise: VariantSuperviseSchema.optional(),
    implode: VariantImplodeSchema.optional(),
    ui: VariantUiSchema.optional(),
    /** Command that seeds a new variant database. A per-variant `seed` wins. */
    seed: z.string().min(1).optional(),
    /** Keyed by watch name; the key is the name in runtime state, templates and environment variables. */
    watches: z
      .record(
        z.string().regex(WATCH_KEY, "must start with a letter and hold letters, digits, - and _"),
        VariantWatchSchema,
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
    const watches = variant.watches ?? {};
    if (UI_WATCH_KEY in watches) {
      context.addIssue({
        code: "custom",
        path: ["watches", UI_WATCH_KEY],
        message: `the watch key ${UI_WATCH_KEY} is reserved for the variant ui server`,
      });
    }
    const segments = new Map<string, string>();
    for (const key of Object.keys(watches)) {
      const segment = envSegment(key);
      if (segment === UI_ENV_SEGMENT) {
        context.addIssue({
          code: "custom",
          path: ["watches", key],
          message: `the watch key ${key} is reserved: its port variable ${UI_PORT_ENV} belongs to the variant ui server`,
        });
      }
      const other = segments.get(segment);
      if (other !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["watches", key],
          message: `watches ${other} and ${key} share the environment variable segment ${segment}`,
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

/** What is known about one running watch of a variant. */
export const RuntimeWatchSchema = z.strictObject({
  port: PortSchema.optional(),
  pid: z.number().int().positive().optional(),
  url: z.string().min(1).optional(),
});
export type RuntimeWatch = z.infer<typeof RuntimeWatchSchema>;

/** Ephemeral state of one variant, written into the variant's own worktree. */
export const RuntimeSchema = z.strictObject({
  slug: z.string().min(1).optional(),
  mode: z.enum(["up", "watch"]).optional(),
  dir: z.string().min(1).optional(),
  /** The log file of a detached `watch`: the output of all its processes. */
  log: z.string().min(1).optional(),
  db: RuntimeDbSchema.optional(),
  /** Keyed by the key of the entry in `variant.watches`. */
  watches: z.record(z.string().min(1), RuntimeWatchSchema).optional(),
});
export type Runtime = z.infer<typeof RuntimeSchema>;
/** The runtime state as resolved: environment templates replaced, so the database port is a number. */
export type ResolvedRuntime = Omit<Runtime, "db"> & { db?: DbConfig };

export const LOCAL_FILENAME = "variants.local.yaml";

/** `variants.local.yaml`, git-ignored, next to variants.yaml in each variant's worktree. Other top-level keys are kept. */
export const VariantsLocalSchema = z.looseObject({ runtime: RuntimeSchema.optional() });
export type VariantsLocal = z.infer<typeof VariantsLocalSchema>;

/** `variant` as resolved by `loadConfig`: defaults applied, watches always a record. */
export type ResolvedVariant = Omit<
  VariantRuntime,
  | "main"
  | "root"
  | "abbr"
  | "prefix"
  | "watches"
  | "baseBranch"
  | "branchPrefixes"
  | "open"
  | "ports"
  | "storage"
  | "supervise"
  | "implode"
> & {
  main: string;
  root: string;
  abbr: string;
  prefix: string;
  watches: Record<string, VariantWatch>;
  baseBranch: string;
  branchPrefixes: string[];
  open: boolean;
  ports: { range: string; low: number; high: number };
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
  /** One line per key of `variants.yaml` that the schema does not define; such keys are ignored. */
  warnings: string[];
  /** One line per name of an earlier version (`instances`, `reservedPorts`) that was read under the current one. */
  migrations: string[];
};

export const variantsJsonSchema = z.toJSONSchema(VariantsConfigSchema);
export const variantsLocalJsonSchema = z.toJSONSchema(VariantsLocalSchema);
