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
 * The tag: one notification slot shared by every completion, because the user
 * reads "the task finished", not a timeline. Reusing the tag makes the browser
 * replace the previous completion instead of stacking a second entry in
 * Notification Center — the stacking is what turns one wake-up into a batch of
 * stale toasts. Pending interactions keep their own per-interaction tags: each
 * one waits for a different answer and must stay visible.
 */
export declare const COMPLETION_TAG = "dsh-notification-completion";
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
