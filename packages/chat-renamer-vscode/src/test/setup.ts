import { mock } from "bun:test";

import { vscodeMock } from "./vscode-mock";

// The `vscode` module only exists inside an extension host. Unit tests get this stand-in instead.
mock.module("vscode", () => vscodeMock);
