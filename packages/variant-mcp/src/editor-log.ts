import { connect, type IpcClient, socketPath } from "variant-ipc";
import type { LogEvent } from "variant-log";

const WRITE_MS = 1000;

let editorClient: IpcClient | undefined;
let connecting: Promise<void> | undefined;
let sendChain = Promise.resolve();
let socketDropped = false;

const limitedWrite = (work: Promise<unknown>): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket write timed out")), WRITE_MS);
    work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("socket write failed"));
      },
    );
  });

const deliver = async (directory: string, event: LogEvent): Promise<void> => {
  if (socketDropped) {
    return;
  }
  if (connecting === undefined) {
    connecting = connect(socketPath(directory)).then(
      (next) => {
        editorClient = next;
      },
      () => {
        editorClient = undefined;
      },
    );
  }
  await connecting;
  if (socketDropped || editorClient === undefined) {
    return;
  }
  const args: Record<string, unknown> = { level: event.level, message: event.message, origin: "mcp" };
  if (event.step !== undefined) {
    args.step = event.step;
  }
  if (event.slug !== undefined) {
    args.slug = event.slug;
  }
  const pending = editorClient.request({ name: "log", args });
  void pending.catch(() => undefined);
  try {
    await limitedWrite(pending);
  } catch (error) {
    if (error instanceof Error && error.message === "socket write timed out") {
      socketDropped = true;
      const client = editorClient;
      editorClient = undefined;
      client?.close();
    }
  }
};

/** Queues one editor log. A missing editor is ignored. A write that is not answered within 1s drops the socket. */
export const sendEditorLog = (directory: string, event: LogEvent): void => {
  sendChain = sendChain.then(() => deliver(directory, event)).catch(() => undefined);
};

/** Waits for queued editor logs, then closes the socket so the process can exit. */
export const finishEditorLog = async (): Promise<void> => {
  let pending = sendChain;
  for (;;) {
    await pending;
    if (pending === sendChain) {
      break;
    }
    pending = sendChain;
  }
  editorClient?.close();
  editorClient = undefined;
  connecting = undefined;
};
