import { describe, expect, it } from "bun:test";

import { claimRenamer, type RenamerRegistry } from "./chat-renamer-claim";

describe("claimRenamer", () => {
  it("makes the first claimant the owner", () => {
    const registry: RenamerRegistry = {};

    const claim = claimRenamer("variant.variant-vscode", registry);

    expect(claim.owned).toBe(true);
    expect(claim.owner).toBe("variant.variant-vscode");
  });

  it("leaves a second claimant idle and tells it who owns renaming", () => {
    const registry: RenamerRegistry = {};
    claimRenamer("variant.variant-vscode", registry);

    const second = claimRenamer("variant.chat-renamer", registry);

    expect(second.owned).toBe(false);
    expect(second.owner).toBe("variant.variant-vscode");
  });

  it("lets the owner claim again, as on a reactivation", () => {
    const registry: RenamerRegistry = {};
    claimRenamer("a.one", registry);

    expect(claimRenamer("a.one", registry).owned).toBe(true);
  });

  it("hands ownership to the next claimant after the owner releases", () => {
    const registry: RenamerRegistry = {};
    const first = claimRenamer("a.one", registry);
    first.release();

    const next = claimRenamer("b.two", registry);

    expect(next.owned).toBe(true);
    expect(next.owner).toBe("b.two");
  });

  it("ignores a release from a claimant that does not own renaming", () => {
    const registry: RenamerRegistry = {};
    claimRenamer("a.one", registry);
    const idle = claimRenamer("b.two", registry);

    idle.release();

    expect(claimRenamer("c.three", registry).owner).toBe("a.one");
  });

  it("shares ownership between separately loaded copies through the host-wide registry", () => {
    const first = claimRenamer("a.one");
    try {
      expect(claimRenamer("b.two").owner).toBe("a.one");
    } finally {
      first.release();
    }
    const after = claimRenamer("b.two");
    expect(after.owned).toBe(true);
    after.release();
  });
});
