/**
 * Specification: openspec/specs/variant-vscode/cursor-command-probe/spec.md
 */
const CHAT_FAMILY = /cursor|composer|aichat|agent/i;
const TITLE_VERB = /rename|title|label/i;

export const selectCursorTitleCommands = (ids: readonly string[]): string[] =>
  [...new Set(ids.filter((id) => CHAT_FAMILY.test(id) && TITLE_VERB.test(id)))].sort();

const EMPTY_PROBE_REPORT = "No rename-like commands found in this build.";

export const formatProbeReport = (ids: readonly string[]): string[] => {
  const matches = selectCursorTitleCommands(ids);
  if (matches.length === 0) {
    return [EMPTY_PROBE_REPORT];
  }
  return matches;
};
