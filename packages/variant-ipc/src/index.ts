import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createConnection, createServer, type Server, type Socket } from "node:net";
import { dirname, join } from "node:path";
import { resolveMainVscodeDir } from "variant-config";
import { z } from "zod";

/**
 * Specification: openspec/specs/variant-ipc/unix-socket/spec.md
 */
export const SOCKET_FILE_NAME = "variant-worktrees.sock";

const requestSchema = z.object({
  name: z.string(),
  args: z.record(z.string(), z.unknown()),
});

export type IpcRequest = z.infer<typeof requestSchema>;

export type IpcHandler = (request: IpcRequest) => unknown | Promise<unknown>;

export type SocketListener = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export type IpcClient = {
  request: (message: IpcRequest) => Promise<unknown>;
  close: () => void;
};

export const socketPath = (startDir: string): string => join(resolveMainVscodeDir(startDir), SOCKET_FILE_NAME);

const writeLine = (socket: Socket, value: unknown): void => {
  const encoded = JSON.stringify(value);
  socket.write(`${encoded === undefined ? "null" : encoded}\n`);
};

const errorLine = (socket: Socket, message: string): void => {
  writeLine(socket, { error: { message: message || "request failed" } });
};

const isErrorBody = (value: unknown): value is { error: { message: string } } => {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = value.error;
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string";
};

const handleLine = async (socket: Socket, line: string, handler: IpcHandler): Promise<void> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    errorLine(socket, "invalid JSON");
    return;
  }
  const request = requestSchema.safeParse(parsed);
  if (!request.success) {
    errorLine(socket, "invalid request");
    return;
  }
  try {
    writeLine(socket, await handler(request.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    errorLine(socket, message);
  }
};

const acceptsConnections = (path: string): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = createConnection(path);
    const finish = (live: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(live);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });

export const createListener = (path: string, handler: IpcHandler): SocketListener => {
  let server: Server | undefined;
  let bound = false;

  return {
    start: async () => {
      const parent = dirname(path);
      if (!existsSync(parent)) {
        mkdirSync(parent, { recursive: true, mode: 0o700 });
        chmodSync(parent, 0o700);
      }
      if (existsSync(path)) {
        if (await acceptsConnections(path)) {
          throw new Error(`socket already listening at ${path}`);
        }
        unlinkSync(path);
      }

      const next = createServer((connection) => {
        let buffer = "";
        let chain = Promise.resolve();
        connection.on("data", (chunk: Buffer) => {
          buffer += chunk.toString("utf8");
          let newline = buffer.indexOf("\n");
          while (newline !== -1) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            chain = chain.then(() => handleLine(connection, line, handler)).catch(() => undefined);
            newline = buffer.indexOf("\n");
          }
        });
      });
      server = next;
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (error: Error) => {
            next.off("listening", onListening);
            reject(error);
          };
          const onListening = () => {
            next.off("error", onError);
            resolve();
          };
          next.once("error", onError);
          next.once("listening", onListening);
          next.listen(path);
        });
        chmodSync(path, 0o600);
        bound = true;
      } catch (error) {
        server = undefined;
        next.close();
        throw error;
      }
    },
    stop: async () => {
      if (!bound || !server) {
        return;
      }
      const current = server;
      server = undefined;
      bound = false;
      await new Promise<void>((resolve, reject) => {
        current.close((error) => (error ? reject(error) : resolve()));
      });
      if (existsSync(path)) {
        unlinkSync(path);
      }
    },
  };
};

export const connect = (path: string): Promise<IpcClient> =>
  new Promise((resolve, reject) => {
    const socket = createConnection(path);
    let settled = false;
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      reject(error);
    };
    socket.once("error", fail);
    socket.once("connect", () => {
      if (settled) {
        return;
      }
      settled = true;
      const pending: Array<{
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
      }> = [];
      let buffer = "";
      socket.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          const waiter = pending.shift();
          if (waiter) {
            try {
              const value: unknown = JSON.parse(line);
              if (isErrorBody(value)) {
                waiter.reject(new Error(value.error.message || "request failed"));
              } else {
                waiter.resolve(value);
              }
            } catch (error) {
              waiter.reject(error instanceof Error ? error : new Error("invalid response"));
            }
          }
          newline = buffer.indexOf("\n");
        }
      });
      resolve({
        request: (message) =>
          new Promise((requestResolve, requestReject) => {
            pending.push({ resolve: requestResolve, reject: requestReject });
            socket.write(`${JSON.stringify(message)}\n`);
          }),
        close: () => {
          socket.end();
        },
      });
    });
  });
