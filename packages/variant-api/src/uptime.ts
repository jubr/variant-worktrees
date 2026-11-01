import { execFileSync } from "node:child_process";

/** Seconds in the `[[dd-]hh:]mm:ss` (or plain seconds) elapsed time that `ps -o etime=` prints; nothing for other text. */
export const parseElapsed = (text: string): number | undefined => {
  const match = /^(?:(?:(\d+)-)?(?:(\d+):)?(\d+):)?(\d+)$/.exec(text.trim());
  if (!match) {
    return undefined;
  }
  const [, days, hours, minutes, seconds] = match;
  return Number(days ?? 0) * 86400 + Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
};

/**
 * How long the process has been running, from the system process table (`ps -o etime=` works on macOS and Linux).
 * Nothing when the process does not exist or `ps` is not available.
 */
export const processUptimeSeconds = (pid: number): number | undefined => {
  try {
    return parseElapsed(
      execFileSync("ps", ["-o", "etime=", "-p", String(pid)], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return undefined;
  }
};
