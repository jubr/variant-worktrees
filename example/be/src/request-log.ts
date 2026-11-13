/** One line for a finished HTTP request, written to stdout so `watch` captures it. */
export const requestLine = (method: string, url: string, status: number): string => `${method} ${url} ${status}`;

export const logRequest = (
  req: { method: string; originalUrl: string },
  res: { statusCode: number; on: (event: "finish", listener: () => void) => void },
  next: () => void,
  write: (line: string) => void = (line) => {
    console.log(line);
  },
): void => {
  res.on("finish", () => write(requestLine(req.method, req.originalUrl, res.statusCode)));
  next();
};
