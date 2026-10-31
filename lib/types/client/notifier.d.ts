/**
 * Client-side notification rendering: the pure parts (title/body/gating) split
 * out for unit tests, while the `Notification` construction stays in the thin
 * runner wired by the plugin body.
 */
import type { NotificationReason, PendingKind } from '../contract.ts';
/** The reason title key for one turn-end reason. */
export declare function titleKey(reason: NotificationReason): 'notify.titleCompleted' | 'notify.titleError' | 'notify.titleAborted' | 'notify.titleBlocked' | 'notify.titleMaxTokens';
/** The title key for one pending interaction. */
export declare function pendingTitleKey(kind: PendingKind): 'notify.titleApproval' | 'notify.titleQuestion' | 'notify.titlePlanReview';
/** The notification body: the reply snippet, or the empty-body fallback. */
export declare function bodyText(body: string, emptyBody: string): string;
/**
 * Whether a completion should surface a desktop notification, given the browser
 * permission, the background-only preference, page visibility, and whether
 * the completed session is the one currently in view.
 */
export declare function shouldShow(permission: NotificationPermission, backgroundOnly: boolean, documentHidden: boolean, completedSessionId?: string, currentSessionId?: string): boolean;
/**
 * The tag prefix every completion notification is minted under.
 *
 * Each completion gets its OWN tag. A reused tag is not a cosmetic choice: the
 * Notifications spec replaces an existing same-tag entry and only re-runs the
 * alert steps when `renotify` is set, and macOS ignores `renotify` outright
 * (Chromium issue 40825295), so a shared tag makes every completion after the
 * first one land silently — the entry is rewritten in place, no banner and no
 * sound. A fresh tag is the only reliable way to actually alert again.
 *
 * "Notification Center keeps a single completion" is preserved by the ledger
 * instead of by tag reuse: the runner closes the previous completion right
 * before it shows the next one. Pending interactions keep their own
 * per-interaction tags: each one waits for a different answer and must stay
 * visible.
 */
export declare const COMPLETION_TAG_PREFIX = "dsh-notification-completion";
/**
 * The tag for one completed turn: unique per session and turn, so the system
 * treats it as a new notification instead of a silent replacement.
 * @param sessionId - the session that finished the turn.
 * @param turn - the completed turn number.
 */
export declare function notificationTag(sessionId: string, turn: number): string;
/**
 * Whether a tag was minted by this plugin for a completion notification (as
 * opposed to a pending interaction or the test notification).
 * @param tag - a tag recovered from a ledger id.
 */
export declare function isCompletionTag(tag: string): boolean;
/**
 * The stable id one constructed notification is tracked under (the ledger key).
 * The browser does not expose the id of a `new Notification()`, so the plugin
 * assigns one per creation and renders a fresh handle from it when withdrawing.
 * @param tag - the notification tag it was shown with.
 * @param sequence - a per-page monotonically increasing counter.
 */
export declare function notificationId(tag: string, sequence: number): string;
/**
 * Split a ledger id back into the tag it was shown with.
 * @param id - a ledger id from {@link notificationId}.
 * @returns the tag, or undefined when the id carries none.
 */
export declare function idTag(id: string): string | undefined;
/** A unique tag for each pending interaction notification in one session. */
export declare function pendingNotificationTag(sessionId: string, sequence: number): string;
/**
 * Render a handle for an id recorded by this page or a previous one.
 *
 * The web API has no "restore by id": a notification is identified by its
 * tag, and constructing one with the same tag re-points the plugin at the live
 * entry, whose `close()` then withdraws it. The constructor is only borrowed
 * as that handle — it is not meant to be shown by the caller.
 * @param api - the browser notification surface.
 * @param id - the ledger id to re-point.
 * @returns the handle, or undefined when the id or the API is unusable.
 */
export declare function restoreNotification(api: typeof Notification | undefined, id: string): Notification | undefined;
/**
 * Withdraw every recorded notification that may still sit in Notification
 * Center. One failing close must not stop the rest.
 * @param api - the browser notification surface.
 * @param ids - the ledger ids to withdraw.
 * @returns the number of handles that closed without throwing.
 */
export declare function closeNotifications(api: typeof Notification | undefined, ids: readonly string[]): number;
/** The surface this code may show notifications on (absent in insecure contexts). */
export declare function notificationsApi(): typeof Notification | undefined;
/** The result of asking the browser to construct one system notification. */
export type NotificationCreationResult = {
    readonly ok: true;
    readonly notification: Notification;
} | {
    readonly ok: false;
    readonly message: string;
};
/** Construct one notification without allowing browser failures to disappear silently. */
export declare function createBrowserNotification(api: typeof Notification | undefined, title: string, options: NotificationOptions): NotificationCreationResult;
