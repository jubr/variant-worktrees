import { isMap, parseDocument } from "yaml";
import { LOCAL_FILENAME } from "./schema.js";

/**
 * Specification: openspec/specs/variant-config/core/spec.md (Schema header)
 *
 * The `yaml-language-server` modeline that gives editors completion and validation for `variants.yaml` and
 * `variants.local.yaml`. New files start with it, and a file without any such line gets it through the migration.
 * Nothing here touches the file system.
 */

const SCHEMA_URL_BASE = "https://github.com/jubr/variant-worktrees/raw/refs/heads/main/packages/variant-config/";

const SCHEMA_LINE = /^[ \t]*#[ \t]*yaml-language-server:[ \t]*\$schema=/m;

/** The suffix of the notice of an added header; the CLI and the extension keep a skipped header-only migration silent. */
export const SCHEMA_HEADER_NOTICE = "the yaml-language-server schema header was added";

/** The modeline for the file with this base name: the local schema for `variants.local.yaml`, else the main one. */
export const schemaHeaderFor = (filename: string): string =>
  `# yaml-language-server: $schema=${SCHEMA_URL_BASE}${filename === LOCAL_FILENAME ? "variants.local.yaml.schema.json" : "variants.yaml.schema.json"}`;

/** The first `yaml-language-server` `$schema` line of `text`, whatever its URL, or undefined. */
export const findSchemaHeader = (text: string): string | undefined =>
  SCHEMA_LINE.exec(text)
    ? text
        .split("\n")
        .find((line) => SCHEMA_LINE.test(line))
        ?.trim()
    : undefined;

/**
 * `text` with the schema header on top, followed by a blank line; undefined when a schema line exists already, or when
 * `text` is not a YAML mapping (empty, comments only, or invalid), so only real configuration files change.
 */
export const addSchemaHeader = (text: string, filename: string): string | undefined => {
  if (findSchemaHeader(text) !== undefined) {
    return undefined;
  }
  const document = parseDocument(text);
  if (document.errors.length > 0 || !isMap(document.contents)) {
    return undefined;
  }
  return `${schemaHeaderFor(filename)}\n\n${text}`;
};

/** The notice for the file when `addSchemaHeader` would change it. */
export const schemaHeaderNotice = (text: string, filename: string, file: string): string | undefined =>
  addSchemaHeader(text, filename) === undefined ? undefined : `${file}: ${SCHEMA_HEADER_NOTICE}`;

/** Whether a notice is the one of an added header (cosmetic, unlike a renamed or dropped setting). */
export const isSchemaHeaderNotice = (notice: string): boolean => notice.endsWith(SCHEMA_HEADER_NOTICE);
