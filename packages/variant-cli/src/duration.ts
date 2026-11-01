const UNITS = [
  ["d", 86400],
  ["h", 3600],
  ["m", 60],
  ["s", 1],
] as const;

/** A duration as its two largest units that are not zero: `45s`, `1m 30s`, `5m`, `2h 5m`, `3d 1h`. */
export const formatDuration = (seconds: number): string => {
  let rest = Math.max(0, Math.floor(seconds));
  const parts: string[] = [];
  for (const [name, size] of UNITS) {
    const count = Math.floor(rest / size);
    rest -= count * size;
    if (count > 0 && parts.length < 2) {
      parts.push(`${count}${name}`);
    }
  }
  return parts.length === 0 ? "0s" : parts.join(" ");
};
