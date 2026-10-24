/**
 * The completion runner's pure decision: one session's list facts + the current
 * settings → an optional notification plan. The host `notification` projection
 * supplies the turn reason, reply text, and tool names; the `title` projection
 * is the fallback when the notification projection has not landed yet. Browser
 * reads (permission, visibility) and the Notification construction stay in the
 * plugin body.
 */
import type { NotificationProjectionValue, NotificationReason, NotificationSettings, PendingKind } from '../contract.ts'
import { asReason, pendingReasonEnabled, ruleSubject, rulesAllow, shouldNotify } from './decision.ts'
import { COMPLETION_TAG, idTag, pendingNotificationTag } from './notifier.ts'

/**
 * Fold one session's projection-turn observation: the first observation seeds
 * the baseline (never fires), and any later advance means the host projection
 * has landed for a NEW completed turn — the fresh value to notify with. Firing
 * on the projection advance (not on a running edge) removes the race between
 * the status frame and the projection frame, so the notification body is
 * always the turn that just completed. The tag is shared by every completion
 * (see `COMPLETION_TAG`), so the browser replaces the previous completion
 * instead of stacking one more entry in Notification Center.
 * @param prevTurn - the turn last observed for the session (undefined = seed).
 * @param projection - the current host projection value (absent = turn 0).
 * @returns the next observed turn and whether it advanced past the previous.
 */
export function projectionAdvance(
  prevTurn: number | undefined,
  projection: NotificationProjectionValue | undefined,
): { nextTurn: number; fresh: boolean } {
  const turn = projection?.turn ?? 0
  return { nextTurn: turn, fresh: prevTurn !== undefined && turn > prevTurn }
}

/** A decided notification ready to surface. */
export interface NotificationPlan {
  readonly reason: NotificationReason
  readonly body: string
  readonly tag: string
}

/** One recorded notification a fresh page still has to withdraw. */
export interface StaleEntry {
  /** The ledger id used to re-point the entry. */
  readonly id: string
  /** The tag it was shown with; the last one of each tag is kept on a soft lock. */
  readonly tag: string
}

/**
 * Pick the recorded notifications a hard lock or logout must withdraw: every
 * one of them, so nothing survives into the next wake-up or login.
 * @param live - surviving ledger ids, oldest first.
 * @returns the entries to close (ids whose tag cannot be recovered are skipped).
 */
export function staleAll(live: readonly string[]): StaleEntry[] {
  return live.flatMap(id => {
    const tag = idTag(id)
    return tag === undefined ? [] : [{ id, tag }]
  })
}

/**
 * Pick the recorded notifications a soft lock (manual lock, screen off, sleep)
 * must withdraw: everything except the newest completion, which is exactly what
 * the user wants to read on wake-up. Pending interactions are always withdrawn —
 * they will be re-armed when the page observes them again.
 * @param live - surviving ledger ids, oldest first.
 * @returns the entries to close.
 */
export function staleExceptNewestCompletion(live: readonly string[]): StaleEntry[] {
  const entries = staleAll(live)
  const newest = entries.map(entry => entry.tag === COMPLETION_TAG).lastIndexOf(true)
  return entries.filter((_entry, index) => index !== newest)
}

/**
 * Decide one completed session's notification, free of any browser read.
 * @param sessionId - the completed session.
 * @param origin - the session's durable origin (subagents are skipped).
 * @param title - the session's durable title (absent until the host projects one).
 * @param projection - the host `notification` projection value.
 * @param settings - the live client settings.
 * @returns the plan, or null when this completion must not notify.
 */
export function notificationFor(
  sessionId: string,
  origin: string | undefined,
  title: string | undefined,
  projection: NotificationProjectionValue | undefined,
  settings: NotificationSettings,
): NotificationPlan | null {
  if (origin === 'subagent') return null
  // The completion edge can arm a tick before the projection frame lands;
  // fall back to a generic completion until the projection arrives.
  const reason: NotificationReason | undefined = projection === undefined || projection.turn === 0
    ? 'completed'
    : asReason(projection.reason)
  if (reason === undefined) return null
  const subject = ruleSubject(title, projection?.body ?? '', projection?.tools ?? [])
  if (!shouldNotify(settings, reason, subject)) return null
  return {
    reason,
    body: projection?.body ?? title ?? '',
    tag: COMPLETION_TAG,
  }
}

/** Fold one session's pending-interaction state and detect a fresh wait. */
export function pendingAdvance(
  prev: { kind: PendingKind | undefined } | undefined,
  kind: PendingKind | undefined,
): { kind: PendingKind | undefined; fresh: boolean } {
  if (prev === undefined) return { kind, fresh: false }
  return { kind, fresh: kind !== undefined && kind !== prev.kind }
}

/** A decided pending-interaction notification. */
export interface PendingNotificationPlan {
  readonly kind: PendingKind
  readonly body: string
  readonly tag: string
}

/** Decide one pending interaction without reading browser state. */
export function pendingNotificationFor(
  sessionId: string,
  origin: string | undefined,
  title: string | undefined,
  kind: PendingKind,
  sequence: number,
  settings: NotificationSettings,
): PendingNotificationPlan | null {
  if (origin === 'subagent') return null
  if (!settings.enabled || !pendingReasonEnabled(settings, kind)) return null
  if (!rulesAllow(settings, ruleSubject(title, '', []))) return null
  return { kind, body: title?.trim() ?? '', tag: pendingNotificationTag(sessionId, sequence) }
}
