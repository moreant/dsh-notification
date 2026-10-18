/**
 * Reading two facts off the running Harness's session surfaces: whether a
 * session is the one on screen, and whether it is waiting for the user.
 *
 * Both moved during the 0.1.x → 0.2.x transition, and a plugin has to read
 * whichever shape it is handed:
 *
 * - "in view": 0.1.x publishes `current` on the session-list snapshot; 0.2.x
 *   dropped that field and reports the main pane's retention instead
 *   (`byId[id].retainedBy.mainView`).
 * - "waiting": 0.1.1 puts `pendingInteraction` on the list row, 0.1.2 adds the
 *   `uiSession.pendingInteractions` observable, and 0.2.x replaces that with
 *   `uiSession.sessionStatus` (one row of running/pending/completion facts per
 *   session).
 *
 * Every reader falls back in that order, so one build serves all layouts.
 * Pure: no browser reads, no store subscriptions — the plugin body wires them.
 */
import type { PendingKind } from '../contract.ts';
/** A session identity. */
export type SessionId = string;
/** The list-row facts these readers need. */
export interface SessionRowFacts {
    /** 0.1.1 carries the waiting interaction on the row itself. */
    readonly pendingInteraction?: PendingKind;
    /**
     * 0.2.x retention counts by consumer. `mainView` counts the main pane, which
     * is the session the user is looking at.
     */
    readonly retainedBy?: Readonly<Record<string, number>>;
}
/** The list-snapshot facts these readers need. */
export interface SessionListFacts {
    readonly byId: Readonly<Record<SessionId, SessionRowFacts>>;
    /** 0.1.x: the selected session. Absent on 0.2.x. */
    readonly current?: SessionId;
}
/** One session's row in the 0.2.x `sessionStatus` map. */
export interface SessionStatusFacts {
    /** The business-owned interaction currently waiting for the user. */
    readonly pendingInteraction?: {
        readonly kind?: string;
    };
}
/** The Session UI faces, in either runtime layout. */
export interface UiSessionFacts {
    /** 0.2.x: running/pending/completion facts per session. */
    readonly sessionStatus?: {
        getSnapshot(): ReadonlyMap<SessionId, SessionStatusFacts>;
    };
    /** 0.1.2: a separate pending-interaction observable. */
    readonly pendingInteractions?: {
        getSnapshot(): ReadonlyMap<SessionId, {
            readonly kind: string;
        }>;
    };
}
/** Narrow a wire/presentation discriminator to the kinds this plugin notifies on. */
export declare function asPendingKind(value: string | undefined): PendingKind | undefined;
/**
 * The session the user is watching right now.
 * @param state - the current list snapshot.
 * @param id - the session whose notification is being gated.
 * @returns the viewed session id, or undefined when that session is not in view.
 */
export declare function viewedSession(state: SessionListFacts, id: SessionId): SessionId | undefined;
/**
 * One session's pending interaction, from whichever source the runtime offers.
 * @param state - the current list snapshot.
 * @param uiSession - the Session UI service face (absent in runtimes without it).
 * @param id - the session to inspect.
 * @returns the pending kind while a business-owned interaction waits for the user.
 */
export declare function pendingKindOf(state: SessionListFacts, uiSession: UiSessionFacts | undefined, id: SessionId): PendingKind | undefined;
