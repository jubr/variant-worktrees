import { describe, expect, it } from "bun:test";
import { logRequest } from "./request-log.js";

describe("request log", () => {
  it("prints one line when the response finishes", () => {
    const lines: string[] = [];
    let finish = (): void => {};
    logRequest(
      { method: "GET", originalUrl: "/api" },
      {
        statusCode: 200,
        on: (_event, listener) => {
          finish = listener;
        },
      },
      () => {},
      (line) => lines.push(line),
    );

    expect(lines).toEqual([]);
    finish();
    expect(lines).toEqual(["GET /api 200"]);
  });
});
