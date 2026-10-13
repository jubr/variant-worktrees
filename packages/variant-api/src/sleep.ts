/** Resolves after `milliseconds`, or right away when `signal` aborts. */
export const sleep = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((done) => {
    const timer = setTimeout(finish, milliseconds);
    function finish(): void {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      done();
    }
    signal?.addEventListener("abort", finish, { once: true });
  });
