import type { LogEvent } from "variant-api";

const LEADING_SLUG = /^\[([^\]]+)\] (?=\[)/;

/**
 * The text a VS Code log channel shows after its own level prefix.
 * A slug is the first token, wrapped as `<slug>`. The message is printed unchanged.
 */
const bracket = (slug: string): string => `<${slug}>`;

export const formatVariantLog = (event: LogEvent): string => {
  if (event.step !== undefined && event.slug !== undefined) {
    return `${bracket(event.slug)} [${event.step}] ${event.message}`;
  }
  if (event.step !== undefined) {
    return `[${event.step}] ${event.message}`;
  }
  const embedded = LEADING_SLUG.exec(event.message);
  if (embedded) {
    return `${bracket(embedded[1])} ${event.message.slice(embedded[0].length)}`;
  }
  if (event.slug && !event.message.startsWith(`${bracket(event.slug)} `)) {
    return `${bracket(event.slug)} ${event.message}`;
  }
  return event.message;
};
