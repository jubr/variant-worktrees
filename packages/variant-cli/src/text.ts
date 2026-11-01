import type {
  DownResult,
  ImplodeResult,
  InstanceFacts,
  InstanceReport,
  UpResult,
  VariantRecord,
  WatchResult,
} from "variant-api";
import { formatDuration } from "./duration.js";
import { formatTable } from "./table.js";

/** Where a text layout is rendered. */
export interface TextOptions {
  /** The variant root, for directories shown relative to it. */
  variantRoot: string;
  /** Print what `--verbose` asks for: a block per variant, as `status` shows it, instead of the list table. */
  verbose?: boolean;
}

const isScalar = (value: unknown): boolean => value === null || typeof value !== "object";

const isEmpty = (value: unknown): boolean =>
  Array.isArray(value) ? value.length === 0 : typeof value === "object" && Object.keys(value as object).length === 0;

const scalarLines = (value: unknown, pad: string): string[] =>
  typeof value === "string" && value.includes("\n")
    ? value
        .trimEnd()
        .split("\n")
        .map((line) => `${pad}  ${line}`)
    : [];

/** Any value as indented `key: value` lines; arrays as `- item` lines. The text form of a result without a layout. */
export const outline = (value: unknown, indent = 0): string[] => {
  const pad = "  ".repeat(indent);
  if (isScalar(value)) {
    return [`${pad}${String(value ?? "-")}`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      isScalar(item) ? [`${pad}- ${String(item ?? "-")}`] : [`${pad}-`, ...outline(item, indent + 1)],
    );
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (isScalar(child)) {
      const multiline = scalarLines(child, pad);
      return multiline.length > 0 ? [`${pad}${key}:`, ...multiline] : [`${pad}${key}: ${String(child ?? "-")}`];
    }
    return isEmpty(child) ? [`${pad}${key}: -`] : [`${pad}${key}:`, ...outline(child, indent + 1)];
  });
};

const pad = (rows: readonly (readonly string[])[]): string[] => {
  const widths = rows.reduce<number[]>((all, row) => row.map((cell, i) => Math.max(all[i] ?? 0, cell.length)), []);
  return rows.map((row) =>
    row
      .map((cell, i) => cell.padEnd(widths[i] ?? 0))
      .join("  ")
      .trimEnd(),
  );
};

/** `label:  value` lines with the values aligned; a pair without a value is left out. */
const pairs = (rows: readonly (readonly [string, string | number | undefined])[]): string[] =>
  pad(
    rows
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([label, value]) => [`${label}:`, String(value)]),
  );

const indented = (lines: readonly string[]): string[] => lines.map((line) => `  ${line}`);

const count = (n: number, singular: string, plural = `${singular}s`): string => `${n} ${n === 1 ? singular : plural}`;

const section = (title: string, lines: readonly string[]): string[] =>
  lines.length > 0 ? [`${title}:`, ...indented(lines)] : [];

const pidCell = (instance: InstanceReport | InstanceFacts): string => {
  if (instance.pid === undefined) {
    return "";
  }
  const alive = "alive" in instance && instance.alive !== undefined ? ` ${instance.alive ? "alive" : "dead"}` : "";
  return `pid ${instance.pid}${alive}`;
};

const instanceRow = (key: string, instance: InstanceReport | InstanceFacts): string[] =>
  [
    key,
    instance.port === undefined ? "" : `port ${instance.port}`,
    pidCell(instance),
    "uptimeSeconds" in instance && instance.uptimeSeconds !== undefined
      ? `up ${formatDuration(instance.uptimeSeconds)}`
      : "",
    instance.url ?? "",
    "container" in instance && instance.container ? instance.container : "",
  ].filter((cell, index, row) => index === 0 || cell !== "" || row.slice(index).some((rest) => rest !== ""));

const instances = (all: Readonly<Record<string, InstanceReport | InstanceFacts>>): string[] =>
  section("instances", pad(Object.entries(all).map(([key, instance]) => instanceRow(key, instance))));

const outputOf = (output: string): string[] => (output.trim() === "" ? [] : ["", ...output.trimEnd().split("\n")]);

/** The facts of one variant: the layout of `create`, and the base of the other record layouts. */
const recordPairs = (record: VariantRecord): string[] => [
  ...pairs([
    ["target", record.target],
    ["dialect", record.dialect],
    ["worktree", record.worktree],
    ["mode", record.mode],
    ["uptime", record.uptimeSeconds === undefined ? undefined : formatDuration(record.uptimeSeconds)],
    ["url", record.url],
    ["log", record.log],
  ]),
  ...instances(record.instances ?? {}),
];

/** A variant as `status` shows it: its slug, its facts and, when it has a runtime state, all of that state. */
const statusBlock = (record: VariantRecord): string[] => {
  const { file, dir, db } = record.runtime ?? {};
  return [
    record.slug,
    ...recordPairs(record),
    ...(record.runtime
      ? ["runtime:", ...indented(outline({ file, ...(dir ? { dir } : {}), ...(db ? { db } : {}) }))]
      : []),
  ];
};

const started = (result: UpResult | WatchResult): string[] => [
  `Started ${result.slug} (${result.mode})`,
  ...pairs([
    ["worktree", result.worktree],
    ["target", result.target],
  ]),
  ...instances(result.instances),
];

const layouts: Record<string, (result: never, options: TextOptions) => string[] | string> = {
  list: (records: VariantRecord[], { variantRoot, verbose }) =>
    verbose ? records.map((record) => statusBlock(record).join("\n")).join("\n\n") : formatTable(records, variantRoot),
  status: (record: VariantRecord) => statusBlock(record),
  create: (record: VariantRecord) => [`Created ${record.slug}`, ...recordPairs(record)],
  provision: (result: { slug: string; commands: string[]; output: string }) => [
    `Provisioned ${result.slug}`,
    ...result.commands.map((command) => `+ ${command}`),
    ...outputOf(result.output),
  ],
  up: (result: UpResult) => [
    ...started(result),
    ...section("containers", pad(result.containers.map(({ key, name, port }) => [key, `port ${port}`, name]))),
    ...outputOf(result.output),
  ],
  watch: (result: WatchResult) => [
    ...started(result),
    ...section("processes", pad(result.processes.map(({ key, pid, command }) => [key, `pid ${pid}`, command]))),
    ...(result.exitCode === 0 ? [] : pairs([["exit code", result.exitCode]])),
    ...outputOf(result.output),
  ],
  down: (result: DownResult) => [
    `Stopped ${result.slug}: ${[
      count(result.processes.length, "process", "processes"),
      count(result.containers.length, "container"),
      count(result.networks.length, "network"),
    ].join(", ")}`,
    ...section("processes", pad(result.processes.map(({ key, pid }) => [key, `pid ${pid}`]))),
    ...section("containers", result.containers),
    ...section("networks", result.networks),
  ],
  implode: (result: ImplodeResult) =>
    !result.removed && !result.worktreeRemoved
      ? `Nothing to implode for ${result.slug}`
      : [
          `Imploded ${result.slug}`,
          ...(result.worktreeRemoved && result.worktree ? [`removed worktree ${result.worktree}`] : []),
          ...(result.report ? ["", ...result.report.split("\n")] : []),
        ],
};

/** The text a command result is printed as: its own layout, else the outline. */
export const renderText = (command: string, result: unknown, options: TextOptions): string => {
  const layout = layouts[command];
  if (!layout) {
    return outline(result).join("\n");
  }
  const lines = layout(result as never, options);
  return typeof lines === "string" ? lines : lines.join("\n");
};
