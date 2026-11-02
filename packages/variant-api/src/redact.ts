/** The value with every non-empty `password` replaced by `***`, at any depth. */
export const redacted = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redacted);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    copy[key] = key === "password" && child ? "***" : redacted(child);
  }
  return copy;
};
