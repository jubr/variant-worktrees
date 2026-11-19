export const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** The longest a test waits for one condition. It stays below `--timeout` of the package `test` script. */
export const WAIT_MS = 10_000;

/** Waits until `condition` holds, or fails naming it, so a slow run fails one test and not the ones after it. */
export const until = async (condition: () => boolean, ms = WAIT_MS, what = "condition"): Promise<void> => {
  for (const deadline = Date.now() + ms; !condition(); await sleep(25)) {
    if (Date.now() > deadline) {
      throw new Error(`${what} not met in time`);
    }
  }
};
