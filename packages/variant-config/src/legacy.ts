import { type Document, isMap, isNode, isPair, isScalar, type Pair, parseDocument, visit, type YAMLMap } from "yaml";

/**
 * Specification: openspec/specs/variant-config/core/spec.md (Legacy configuration is read under the current names)
 *
 * The names of the 0.0.x files: `variant.instances` and `runtime.instances` became `watches`, the setting
 * `variant.reservedPorts` is gone (a range replaces it), and the templates `{{...}}` became `${...}`. Nothing here
 * touches the file system.
 *
 * Specification: openspec/specs/variant-config/core/spec.md (Legacy template syntax)
 */

const FORMER_TEMPLATE = /\{\{((?:[^{}]|\$\{[^{}]*\})*)\}\}/g;
const FORMER_PLACEHOLDER =
  /^(?:slug|abbr|schema|storage|worktree|url|port|port\.[A-Za-z][A-Za-z0-9_-]*|[A-Za-z][A-Za-z0-9_-]*\.port)$/;
const FORMER_ENVIRONMENT = /^[A-Za-z_][A-Za-z0-9_]*(?::-[\s\S]*)?$/;
/** Settings that hold regular expressions, in which `{{` can be a quantifier. */
const REGEX_SETTINGS = new Set(["filterLinesRegex", "activationPatterns"]);

/** `text` with each former template of a placeholder or environment shape in the current form, innermost first. */
const convertTemplates = (text: string): string => {
  let current = text;
  for (;;) {
    const next = current.replace(FORMER_TEMPLATE, (match, inner: string) =>
      FORMER_PLACEHOLDER.test(inner) || FORMER_ENVIRONMENT.test(inner) ? `\${${inner}}` : match,
    );
    if (next === current) {
      return current;
    }
    current = next;
  }
};

/** Converts the former templates of every string in `value`, except in regular-expression settings; counts changes. */
const convertData = (value: unknown, setting: string | undefined, changed: { count: number }): unknown => {
  if (typeof value === "string") {
    const converted = setting !== undefined && REGEX_SETTINGS.has(setting) ? value : convertTemplates(value);
    changed.count += converted === value ? 0 : 1;
    return converted;
  }
  if (Array.isArray(value)) {
    return value.map((item) => convertData(item, setting, changed));
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, convertData(item, key, changed)]));
  }
  return value;
};

export interface Migrated {
  data: unknown;
  /** One line per change: the file and what was renamed or dropped. */
  notices: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Renames `<section>.instances` to `<section>.watches` in `target`; the new key wins when both exist. */
const renameInstances = (
  target: Record<string, unknown>,
  section: "variant" | "runtime",
  file: string,
  notices: string[],
): void => {
  if (!("instances" in target)) {
    return;
  }
  if ("watches" in target) {
    notices.push(`${file}: ${section}.instances was ignored because ${section}.watches is present`);
  } else {
    target.watches = target.instances;
    notices.push(`${file}: ${section}.instances is now ${section}.watches`);
  }
  delete target.instances;
};

/**
 * `data` of `variants.yaml` or `variants.local.yaml` under the current names, in a copy, with a notice for every change.
 * Both names present: the current one wins and the old one is dropped.
 */
export const migrateLegacy = (data: unknown, file: string): Migrated => {
  if (!isRecord(data)) {
    return { data, notices: [] };
  }
  const copy = structuredClone(data);
  const notices: string[] = [];
  const { variant, runtime } = copy;
  if (isRecord(variant)) {
    renameInstances(variant, "variant", file, notices);
    if ("reservedPorts" in variant) {
      delete variant.reservedPorts;
      notices.push(`${file}: variant.reservedPorts was dropped; free ports come from variant.ports.range`);
    }
  }
  if (isRecord(runtime)) {
    renameInstances(runtime, "runtime", file, notices);
  }
  const templates = { count: 0 };
  const converted = convertData(copy, undefined, templates);
  if (templates.count > 0) {
    notices.push(`${file}: {{...}} templates are now \${...}; write $\${ for a literal \${ that a shell must see`);
  }
  return { data: converted, notices };
};

const mapAt = (root: YAMLMap, key: string): YAMLMap | undefined => {
  const value = root.get(key, true);
  return isMap(value) ? value : undefined;
};

interface Edit {
  start: number;
  end: number;
  replacement: string;
}

const lineStart = (text: string, offset: number): number => text.lastIndexOf("\n", offset - 1) + 1;
const lineEnd = (text: string, offset: number): number => {
  const newline = text.indexOf("\n", offset);
  return newline === -1 ? text.length : newline + 1;
};

/** The edit that removes `pair` with its lines; nothing when it does not start its own line (flow style). */
const removal = (text: string, pair: Pair): Edit | undefined => {
  const keyRange = isScalar(pair.key) ? pair.key.range : undefined;
  if (!keyRange) {
    return undefined;
  }
  const start = lineStart(text, keyRange[0]);
  if (text.slice(start, keyRange[0]).trim() !== "") {
    return undefined;
  }
  const valueEnd = isNode(pair.value) && pair.value.range ? pair.value.range[1] : keyRange[1];
  return { start, end: lineEnd(text, Math.max(valueEnd - 1, keyRange[1])), replacement: "" };
};

const isInstances = (pair: Pair): boolean => isScalar(pair.key) && pair.key.value === "instances";

/** The edits that give `map` its `watches` key: rename `instances`, or drop it when `watches` exists. */
const renameEdits = (text: string, map: YAMLMap): Edit[] | undefined => {
  const pair = map.items.find(isInstances);
  if (!pair) {
    return [];
  }
  if (map.has("watches")) {
    const edit = removal(text, pair);
    return edit ? [edit] : undefined;
  }
  const range = isScalar(pair.key) ? pair.key.range : undefined;
  return range ? [{ start: range[0], end: range[1], replacement: "watches" }] : undefined;
};

const removeEdits = (text: string, map: YAMLMap, key: string): Edit[] | undefined => {
  const pair = map.items.find((item) => isScalar(item.key) && item.key.value === key);
  if (!pair) {
    return [];
  }
  const edit = removal(text, pair);
  return edit ? [edit] : undefined;
};

/** Whether `path` (the ancestors of a node) passes through a setting that holds regular expressions. */
const inRegexSetting = (path: readonly unknown[]): boolean =>
  path.some((item) => isPair(item) && isScalar(item.key) && REGEX_SETTINGS.has(String(item.key.value)));

/** The edits that give the string values of `document` the current template form, each in its own source text. */
const templateEdits = (text: string, document: Document.Parsed): Edit[] => {
  const edits: Edit[] = [];
  visit(document, {
    Scalar(key, node, path) {
      if (key === "key" || typeof node.value !== "string" || !node.range || inRegexSetting(path)) {
        return;
      }
      const raw = text.slice(node.range[0], node.range[1]);
      const converted = convertTemplates(raw);
      if (converted !== raw) {
        edits.push({ start: node.range[0], end: node.range[1], replacement: converted });
      }
    },
  });
  return edits;
};

/** The same changes through the document, which keeps order and comments but may move a comment of a key. */
const rewriteDocument = (document: Document.Parsed): string | undefined => {
  let changed = false;
  const root = document.contents as YAMLMap;
  const variant = mapAt(root, "variant");
  const runtime = mapAt(root, "runtime");
  for (const map of [variant, runtime]) {
    const pair = map?.items.find(isInstances);
    if (map && pair && isScalar(pair.key)) {
      if (map.has("watches")) {
        map.delete("instances");
      } else {
        pair.key.value = "watches";
      }
      changed = true;
    }
  }
  if (variant?.has("reservedPorts")) {
    variant.delete("reservedPorts");
    changed = true;
  }
  visit(document, {
    Scalar(key, node, path) {
      if (key !== "key" && typeof node.value === "string" && !inRegexSetting(path)) {
        const converted = convertTemplates(node.value);
        if (converted !== node.value) {
          node.value = converted;
          changed = true;
        }
      }
    },
  });
  return changed ? document.toString({ lineWidth: 0 }) : undefined;
};

/**
 * The text of `variants.yaml` or `variants.local.yaml` with the same changes as `migrateLegacy`, keeping comments, key
 * order and layout: only the renamed key and the dropped lines differ. Nothing when the text needs no change or is not a
 * YAML mapping.
 */
export const migrateText = (text: string): string | undefined => {
  const document = parseDocument(text);
  if (document.errors.length > 0 || !isMap(document.contents)) {
    return undefined;
  }
  const variant = mapAt(document.contents, "variant");
  const runtime = mapAt(document.contents, "runtime");
  const parts = [
    variant ? renameEdits(text, variant) : [],
    variant ? removeEdits(text, variant, "reservedPorts") : [],
    runtime ? renameEdits(text, runtime) : [],
  ];
  if (parts.some((part) => part === undefined)) {
    return rewriteDocument(document);
  }
  const structural = (parts as Edit[][]).flat();
  const removed = structural.filter((edit) => edit.replacement === "" && edit.end > edit.start);
  const templates = templateEdits(text, document).filter(
    (edit) => !removed.some((gone) => edit.start >= gone.start && edit.end <= gone.end),
  );
  const edits = [...structural, ...templates].sort((left, right) => right.start - left.start);
  return edits.length === 0
    ? undefined
    : edits.reduce((result, edit) => result.slice(0, edit.start) + edit.replacement + result.slice(edit.end), text);
};
