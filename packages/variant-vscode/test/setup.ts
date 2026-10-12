import { mock } from "bun:test";

import * as vscodeMock from "../mocks/vscode.ts";

// The `vscode` module only exists inside an extension host. Unit tests of this package and of the workspace
// packages it embeds get this stand-in instead.
mock.module("vscode", () => vscodeMock);
