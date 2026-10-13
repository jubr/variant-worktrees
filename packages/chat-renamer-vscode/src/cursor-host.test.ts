import { afterEach, describe, expect, it } from "bun:test";
import { BUILTIN_AGENT_HOST_ID } from "chat-renamer-api";
import type * as vscode from "vscode";

import { vscodeMock } from "../test/vscode-mock";
import { resolveChatRenameDeps } from "./cursor-host";

const context = (packageJSON: unknown) => ({ extension: { packageJSON } }) as unknown as vscode.ExtensionContext;

describe("resolveChatRenameDeps", () => {
  const originalGetExtension = vscodeMock.extensions.getExtension;

  afterEach(() => {
    vscodeMock.extensions.getExtension = originalGetExtension;
  });

  it("borrows the identity of the built-in agent-host extension when this host lists it", () => {
    const listed = { identifier: { value: BUILTIN_AGENT_HOST_ID, _lower: BUILTIN_AGENT_HOST_ID }, isBuiltin: true };
    vscodeMock.extensions.getExtension = (id) => (id === BUILTIN_AGENT_HOST_ID ? { packageJSON: listed } : undefined);

    expect(resolveChatRenameDeps(context({})).donor).toBe(listed);
  });

  it("falls back to a stand-in identity when the agent host runs in another extension host", () => {
    vscodeMock.extensions.getExtension = () => undefined;
    const mine = { identifier: { value: "someone.else" } };

    const deps = resolveChatRenameDeps(context(mine));
    const donor = deps.donor as { identifier: { value: string; _lower: string }; isBuiltin: boolean };

    expect(deps.mine).toBe(mine);
    expect(donor.isBuiltin).toBe(true);
    expect(donor.identifier.value).toBe(BUILTIN_AGENT_HOST_ID);
    // Cursor compares identifiers through the lower-cased key.
    expect(donor.identifier._lower).toBe(BUILTIN_AGENT_HOST_ID);
    expect(deps.donor.enabledApiProposals).toEqual(expect.arrayContaining(["cursor", "cursorAgentHost"]));
  });
});
