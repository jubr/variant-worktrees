/** Who currently runs the rename triggers in this extension host. */
export type RenamerRegistry = { owner?: string };

export type RenamerClaim = {
  /** True when this extension runs the triggers. */
  owned: boolean;
  /** Id of the extension that runs them. */
  owner: string;
  /** Gives up ownership. Does nothing for a claimant that does not own renaming. */
  release(): void;
};

const REGISTRY_KEY = Symbol.for("chat-renamer.owner");

/**
 * Each extension that embeds the renamer bundles its own copy of this code, so the default registry lives on
 * `globalThis`, which every copy in one extension host shares.
 */
const hostRegistry = (): RenamerRegistry => {
  const host = globalThis as unknown as Record<symbol, RenamerRegistry | undefined>;
  host[REGISTRY_KEY] ??= {};
  return host[REGISTRY_KEY];
};

/** First claimant wins; later ones are told who owns renaming and should stay idle. */
export const claimRenamer = (extensionId: string, registry: RenamerRegistry = hostRegistry()): RenamerClaim => {
  registry.owner ??= extensionId;
  const owned = registry.owner === extensionId;
  return {
    owned,
    owner: registry.owner,
    release: () => {
      if (owned && registry.owner === extensionId) {
        registry.owner = undefined;
      }
    },
  };
};
