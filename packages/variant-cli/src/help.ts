import { LOG_LEVEL_FLAG, VERBOSITY_FLAG } from "./ipc-log.js";
import { GLOBAL_FLAGS } from "./output.js";

/** Flags cleye adds itself; they apply to every command, so they are listed with the global flags. */
const BUILT_IN = new Set(["help", "version"]);

interface FlagCell {
  type: string;
  data: { name: string; flag: Record<string, unknown>; flagFormatted: string; aliasesEnabled: boolean };
}

interface Table {
  data: { tableData: [FlagCell, FlagCell][]; [key: string]: unknown };
  [key: string]: unknown;
}

interface Section {
  id: string;
  type: "section";
  data: { title: string; body: Table };
}

const flagRow = (name: string, description: string): [FlagCell, FlagCell] => {
  const data = { name, flag: { type: Boolean, description }, flagFormatted: `--${name}`, aliasesEnabled: true };
  return [
    { type: "flagName", data },
    { type: "flagDescription", data },
  ];
};

/** A global flag with no long name, shown as typed: `-C <path>`, `-v`. */
const shortRow = (name: string, description: string, placeholder?: string): [FlagCell, FlagCell] => {
  const data = {
    name,
    flag: { type: placeholder === undefined ? Boolean : String, description, ...(placeholder ? { placeholder } : {}) },
    flagFormatted: `-${name}`,
    aliasesEnabled: false,
  };
  return [
    { type: "flagName", data },
    { type: "flagDescription", data },
  ];
};

/** `-s, --slug <slug>`: the slug is a global flag, so it is listed here and not among the flags of a command. */
const slugRow = (): [FlagCell, FlagCell] => {
  const data = {
    name: "slug",
    flag: {
      type: String,
      description: "Variant slug; defaults to the current git worktree",
      placeholder: "<slug>",
    },
    flagFormatted: "--slug",
    aliasFormatted: "-s",
    aliasesEnabled: true,
  };
  return [
    { type: "flagName", data },
    { type: "flagDescription", data },
  ];
};

interface Column {
  paddingBottom?: number;
}

/** A copy of cleye's flag-table breakpoints with no blank line after a global flag row. */
const withoutBottomPadding = (breakpoints: unknown): unknown => {
  if (typeof breakpoints !== "object" || breakpoints === null) {
    return breakpoints;
  }
  const zero = (columns: readonly Column[]): Column[] => columns.map((column) => ({ ...column, paddingBottom: 0 }));
  return Object.fromEntries(
    Object.entries(breakpoints).map(([name, value]) => {
      if (Array.isArray(value)) {
        return [name, zero(value as Column[])];
      }
      if (typeof value === "object" && value !== null && Array.isArray((value as { columns?: unknown }).columns)) {
        const entry = value as { columns: Column[] };
        return [name, { ...entry, columns: zero(entry.columns) }];
      }
      return [name, value];
    }),
  );
};

const isFlagsSection = (node: unknown): node is Section => (node as { id?: string }).id === "flags";

const flagsSection = (nodes: readonly unknown[]): Section | undefined => nodes.find(isFlagsSection);

/**
 * The help document with the global flags in a section of their own after `Flags`: `-C`, `-s`, `--json`, `--yaml`, `--log-level`, `-v` and the
 * flags cleye adds (`--help`, and `--version` on the top level), which then no longer appear among the flags of the command.
 * A `Flags` section left without flags is dropped.
 */
export const withGlobalFlags = <Node>(nodes: Node[]): Node[] => {
  const flags = flagsSection(nodes);
  const rows = flags?.data.body.data.tableData ?? [];
  const builtIn = rows.filter(([name]) => BUILT_IN.has(name.data.name));
  const own = rows.filter(([name]) => !BUILT_IN.has(name.data.name));
  const global: Section = {
    id: "globalFlags",
    type: "section",
    data: {
      title: "Global flags:",
      body: {
        ...(flags?.data.body ?? { type: "table" }),
        data: {
          ...(flags?.data.body.data ?? {}),
          tableBreakpoints: withoutBottomPadding(flags?.data.body.data.tableBreakpoints),
          tableData: [
            shortRow("C", "Change to <path> before reading configuration", "<path>"),
            slugRow(),
            ...GLOBAL_FLAGS.map(({ name, description }) => flagRow(name, description)),
            flagRow(LOG_LEVEL_FLAG.name, LOG_LEVEL_FLAG.description),
            shortRow(VERBOSITY_FLAG.name, VERBOSITY_FLAG.description),
            ...builtIn,
          ],
        },
      } as Table,
    },
  };
  return nodes.flatMap((node): Node[] => {
    if (!isFlagsSection(node)) {
      return [node];
    }
    const { body } = node.data;
    const remaining: Section[] =
      own.length > 0
        ? [{ ...node, data: { ...node.data, body: { ...body, data: { ...body.data, tableData: own } } } }]
        : [];
    return [...remaining, global] as unknown as Node[];
  });
};

const ESCAPE = String.fromCharCode(27);

/** Trailing blanks of a line, and the color resets after them, which stay. */
const TRAILING_BLANKS = new RegExp(`[ \\t]+((?:${ESCAPE}\\[[0-9;]*m)*)$`, "gm");

/**
 * The help without the padding cleye gives every table row up to the width of the terminal. A row that fills the
 * whole width makes a terminal that wraps at the last column (GNU screen) print an empty line after it.
 */
export const withoutTrailingBlanks = (text: string): string => text.replace(TRAILING_BLANKS, "$1");

/** The `render` option of cleye's `help`, for the top level and for every command. */
export const renderHelp = <Node>(nodes: Node[], renderers: { render: (nodes: Node[]) => string }): string =>
  withoutTrailingBlanks(renderers.render(withGlobalFlags(nodes)));

/** The `render` option of the top-level help, which follows the version text and so leaves out cleye's `variant v<version>` line. */
export const renderTopHelp = <Node extends { id?: string }>(
  nodes: Node[],
  renderers: { render: (nodes: Node[]) => string },
): string =>
  renderHelp(
    nodes.filter((node) => node.id !== "name"),
    renderers,
  );
