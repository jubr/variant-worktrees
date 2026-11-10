import { LOG_LEVEL_FLAG } from "./ipc-log.js";
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

const isFlagsSection = (node: unknown): node is Section => (node as { id?: string }).id === "flags";

const flagsSection = (nodes: readonly unknown[]): Section | undefined => nodes.find(isFlagsSection);

/**
 * The help document with the global flags in a section of their own after `Flags`: `--json`, `--yaml` and the flags
 * cleye adds (`--help`, and `--version` on the top level), which then no longer appear among the flags of the command.
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
          tableData: [
            ...GLOBAL_FLAGS.map(({ name, description }) => flagRow(name, description)),
            flagRow(LOG_LEVEL_FLAG.name, LOG_LEVEL_FLAG.description),
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

/** The `render` option of cleye's `help`, for the top level and for every command. */
export const renderHelp = <Node>(nodes: Node[], renderers: { render: (nodes: Node[]) => string }): string =>
  renderers.render(withGlobalFlags(nodes));
