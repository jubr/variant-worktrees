import { useState } from "react";

/** Runs one action at a time for a row: pending while it runs, and the message of the error it failed with. */
export const useAction = () => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const run = async (action: () => Promise<void>): Promise<void> => {
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPending(false);
    }
  };
  return { pending, error, run };
};
