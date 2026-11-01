import type { Variant } from "./model.js";

export type VariantState = "watching" | "up" | "down";

/** The key under which the UI server records itself in the runtime state of `main`; it is not part of main's own run. */
export const UI_INSTANCE_KEY = "variant-ui";

/**
 * `watching` or `up` when the record's mode has a live instance, otherwise `down`. A recorded mode whose processes are
 * all gone is `down` and `stale`.
 */
export const stateOf = (variant: Variant): { state: VariantState; stale: boolean } => {
  const alive = Object.entries(variant.instances ?? {}).some(
    ([key, instance]) => key !== UI_INSTANCE_KEY && instance.alive,
  );
  if (variant.mode === undefined) {
    return { state: "down", stale: false };
  }
  if (!alive) {
    return { state: "down", stale: true };
  }
  return { state: variant.mode === "watch" ? "watching" : "up", stale: false };
};

/** `2m 5s`, `1h 1m`: the two largest units of a duration. */
export const formatUptime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${total % 60}s`;
  }
  return `${total}s`;
};
