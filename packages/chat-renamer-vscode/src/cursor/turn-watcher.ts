import { AWAKE_AGENT_HOST_EVENTS, type Description, type Logger, withBorrowedIdentity } from "chat-renamer-api";

/** Cursor's retrieval extension. Creating a turn watcher is limited to this id. */
export const RETRIEVAL_EXTENSION_ID = "anysphere.cursor-retrieval";

const RETRIEVAL_PROPOSALS = [
  "control",
  "cursor",
  "cursorAgentHost",
  "cursorNoDeps",
  "cursorTracing",
  "textSearchProvider2",
];

/** The listed retrieval extension, or a stand-in when that host does not see it. */
export const retrievalDonor = (listed: Description | undefined): Description =>
  listed ?? {
    identifier: { value: RETRIEVAL_EXTENSION_ID, _lower: RETRIEVAL_EXTENSION_ID },
    isBuiltin: true,
    enabledApiProposals: [...RETRIEVAL_PROPOSALS],
  };

export type TurnRef = { sessionId: string; turnId: string };

export type AgentHostTurnWatcher = {
  onDidStartTurn: (listener: (event: TurnRef) => void) => { dispose(): void };
  onDidEndTurn: (listener: (event: TurnRef) => void) => { dispose(): void };
  dispose(): void;
};

export type TurnWatch = {
  active(): boolean;
  setPollActive(active: boolean): void;
  dispose(): void;
  readonly created: boolean;
};

export type TurnWatchDeps = {
  mine: Description;
  donor: Description;
  create: () => AgentHostTurnWatcher;
  log: Logger;
  highVolumeCategories: () => readonly string[];
  /** Called after a start or end updates the open set. */
  onTurn?: () => void;
};

const turnKey = (event: TurnRef): string => `${event.sessionId}\0${event.turnId}`;

/**
 * Subscribes to Cursor's turn watcher. The borrow lasts only for the synchronous create.
 *
 * Specification: openspec/specs/chat-renamer/awake/spec.md
 */
export const startTurnWatch = (deps: TurnWatchDeps): TurnWatch => {
  const awake = deps.log.child("awake");
  const open = new Set<string>();
  let pollActive = false;
  let disposed = false;
  let watcher: AgentHostTurnWatcher | undefined;
  const subscriptions: { dispose(): void }[] = [];

  const traceTurn = (phase: "start" | "end", event: TurnRef): void => {
    if (!deps.highVolumeCategories().includes(AWAKE_AGENT_HOST_EVENTS)) {
      return;
    }
    awake.trace("turn", { sessionId: event.sessionId, turnId: event.turnId, phase });
  };

  let created = false;
  try {
    watcher = withBorrowedIdentity(deps, () => deps.create());
    subscriptions.push(
      watcher.onDidStartTurn((event) => {
        if (disposed) {
          return;
        }
        open.add(turnKey(event));
        traceTurn("start", event);
        deps.onTurn?.();
      }),
    );
    subscriptions.push(
      watcher.onDidEndTurn((event) => {
        if (disposed) {
          return;
        }
        open.delete(turnKey(event));
        traceTurn("end", event);
        deps.onTurn?.();
      }),
    );
    created = true;
  } catch {
    for (const subscription of subscriptions) {
      subscription.dispose();
    }
    subscriptions.length = 0;
    watcher?.dispose();
    watcher = undefined;
    created = false;
  }

  return {
    created,
    active: () => !disposed && (open.size > 0 || pollActive),
    setPollActive: (active) => {
      if (!disposed) {
        pollActive = active;
      }
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
      subscriptions.length = 0;
      watcher?.dispose();
      watcher = undefined;
      open.clear();
      pollActive = false;
    },
  };
};
