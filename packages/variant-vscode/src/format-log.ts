import type { LogEvent } from "variant-api";

const COMMANDED = /^\[([^\]]+)\] \+ (.+)$/;
const LEADING_SLUG = /^\[([^\]]+)\] (?=\[)/;

/**
 * The text a VS Code log channel shows after its own `[info]` prefix.
 * A slug is the first token, wrapped as `<slug>`. `[action] + command` is written `cmd="command"`.
 */
const bracket = (slug: string): string => `<${slug}>`;

export const formatVariantLog = (event: LogEvent): string => {
  if (event.step !== undefined && event.message.startsWith("+ ")) {
    const slug = event.slug ? `${bracket(event.slug)} ` : "";
    return `${slug}[${event.step}] cmd=${JSON.stringify(event.message.slice(2))}`;
  }
  if (event.step !== undefined && event.slug !== undefined) {
    return `${bracket(event.slug)} [${event.step}] ${event.message}`;
  }
  const command = COMMANDED.exec(event.message);
  if (command) {
    const slug = event.slug ? `${bracket(event.slug)} ` : "";
    return `${slug}[${command[1]}] cmd=${JSON.stringify(command[2])}`;
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
