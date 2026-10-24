/**
 * Client-side notification rendering: the pure parts (title/body/gating) split
 * out for unit tests, while the `Notification` construction stays in the thin
 * runner wired by the plugin body.
 */
import type { NotificationReason, PendingKind } from '../contract.ts'

/** The reason title key for one turn-end reason. */
export function titleKey(reason: NotificationReason): 'notify.titleCompleted' | 'notify.titleError' | 'notify.titleAborted' | 'notify.titleBlocked' | 'notify.titleMaxTokens' {
  switch (reason) {
    case 'completed': return 'notify.titleCompleted'
    case 'error': return 'notify.titleError'
    case 'aborted': return 'notify.titleAborted'
    case 'blocked': return 'notify.titleBlocked'
    case 'max-tokens': return 'notify.titleMaxTokens'
  }
}

/** The title key for one pending interaction. */
export function pendingTitleKey(kind: PendingKind): 'notify.titleApproval' | 'notify.titleQuestion' | 'notify.titlePlanReview' {
  switch (kind) {
    case 'approval': return 'notify.titleApproval'
    case 'question': return 'notify.titleQuestion'
    case 'plan-review': return 'notify.titlePlanReview'
  }
}

/** The notification body: the reply snippet, or the empty-body fallback. */
export function bodyText(body: string, emptyBody: string): string {
  const trimmed = body.trim()
  return trimmed === '' ? emptyBody : trimmed
}

/**
 * Whether a completion should surface a desktop notification, given the browser
 * permission, the background-only preference, page visibility, and whether
 * the completed session is the one currently in view.
 */
export function shouldShow(
  permission: NotificationPermission,
  backgroundOnly: boolean,
  documentHidden: boolean,
  completedSessionId?: string,
  currentSessionId?: string,
): boolean {
  if (permission !== 'granted') return false
  if (backgroundOnly && !documentHidden && completedSessionId === currentSessionId) return false
  return true
}

/**
 * The tag: one notification slot shared by every completion, because the user
 * reads "the task finished", not a timeline. Reusing the tag makes the browser
 * replace the previous completion instead of stacking a second entry in
 * Notification Center — the stacking is what turns one wake-up into a batch of
 * stale toasts. Pending interactions keep their own per-interaction tags: each
 * one waits for a different answer and must stay visible.
 */
export const COMPLETION_TAG = 'dsh-notification-completion'

/**
 * The stable id one constructed notification is tracked under (the ledger key).
 * The browser does not expose the id of a `new Notification()`, so the plugin
 * assigns one per creation and renders a fresh handle from it when withdrawing.
 * @param tag - the notification tag it was shown with.
 * @param sequence - a per-page monotonically increasing counter.
 */
export function notificationId(tag: string, sequence: number): string {
  return `${tag}#${sequence}`
}

/**
 * Split a ledger id back into the tag it was shown with.
 * @param id - a ledger id from {@link notificationId}.
 * @returns the tag, or undefined when the id carries none.
 */
export function idTag(id: string): string | undefined {
  const at = id.lastIndexOf('#')
  if (at <= 0) return undefined
  return id.slice(0, at)
}

/** A unique tag for each pending interaction notification in one session. */
export function pendingNotificationTag(sessionId: string, sequence: number): string {
  return `dsh-notification-pending-${sessionId}-${sequence}`
}

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
export function restoreNotification(api: typeof Notification | undefined, id: string): Notification | undefined {
  const tag = idTag(id)
  if (api === undefined || tag === undefined) return undefined
  try {
    return new api('', { tag })
  } catch {
    return undefined
  }
}

/**
 * Withdraw every recorded notification that may still sit in Notification
 * Center. One failing close must not stop the rest.
 * @param api - the browser notification surface.
 * @param ids - the ledger ids to withdraw.
 * @returns the number of handles that closed without throwing.
 */
export function closeNotifications(api: typeof Notification | undefined, ids: readonly string[]): number {
  let closed = 0
  for (const id of ids) {
    const handle = restoreNotification(api, id)
    if (handle === undefined) continue
    try {
      handle.close()
      closed += 1
    } catch {
      // A browser that refuses to close one entry must not block the others.
    }
  }
  return closed
}

/** The surface this code may show notifications on (absent in insecure contexts). */
export function notificationsApi(): typeof Notification | undefined {
  return typeof Notification === 'undefined' ? undefined : Notification
}

/** The result of asking the browser to construct one system notification. */
export type NotificationCreationResult =
  | { readonly ok: true; readonly notification: Notification }
  | { readonly ok: false; readonly message: string }

/** Construct one notification without allowing browser failures to disappear silently. */
export function createBrowserNotification(
  api: typeof Notification | undefined,
  title: string,
  options: NotificationOptions,
): NotificationCreationResult {
  if (api === undefined) return { ok: false, message: 'The Notification API is unavailable in this browser context.' }
  if (api.permission !== 'granted') return { ok: false, message: 'Notification permission is not granted.' }
  try {
    return { ok: true, notification: new api(title, options) }
  } catch (error) {
    /* v8 ignore next -- browsers throw Error objects for constructor failures. */
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, message }
  }
}
