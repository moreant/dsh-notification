/**
 * The delivered-notification ledger: the client's own record of the
 * notifications it has handed to the operating system, so it can withdraw
 * them instead of leaving each one in Notification Center until the user
 * clears it by hand.
 *
 * Why this exists: Chromium keeps a web notification in Notification Center
 * until it is dismissed or closed, and `usernoted` re-posts whatever is still
 * in its store when the login session restarts or the display wakes (a batch
 * of stale toasts a few seconds after logging in). `Notification.close()` is
 * the only way to withdraw a live entry, and the handle is browser memory —
 * so the ledger renders a fresh handle for each surviving id on every page
 * load and closes it at the earliest moment the notification can no longer be
 * useful (the system is about to suspend or switch off).
 *
 * Persistence marks how a batch ended (`alive` = the page went away and the
 * entries are probably still in Notification Center, `shown` = still on
 * screen, `closed` = already withdrawn), so the next page load can withdraw
 * the survivors without touching anything else.
 *
 * Pure: storage and clock are injected; the plugin body wires the real
 * browser (localStorage, pagehide, power/beforeunload events).
 */

/** The storage face the ledger needs. */
export interface LedgerStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** One id the plugin delivered to the system, with its batch's state. */
export type LedgerState = 'shown' | 'alive' | 'closed'

/** Surviving entry ids, oldest batch first, already deduplicated. */
export interface LedgerSnapshot {
  /** Ids whose entry may still exist in Notification Center (`shown` or `alive`). */
  readonly live: readonly string[]
  /** How many stored ids were dropped while folding; non-zero means truncation. */
  readonly dropped: number
}

/** The ledger: storage plus one in-memory state per id observed this page. */
export interface Ledger {
  /** Record a freshly constructed notification (it was shown on screen). */
  show(id: string): void
  /** Mark every id of one batch closed after a batch-level close. */
  closeState(ids: readonly string[]): void
  /** Forget one id once per-notification close or click has withdrawn it. */
  close(id: string): void
  /** Fold the stored entries down to the ids a fresh page must withdraw. */
  survivors(): LedgerSnapshot
  /** Drop every stored id that is no longer live (before re-rendering handles). */
  prune(live: readonly string[]): void
  /** Drop the whole ledger (the user asked never to be reminded of it). */
  clear(): void
}

/** Bounded ledger size: enough for a long day of sessions, small enough for localStorage. */
export const LEDGER_CAP = 200

/** One stored entry: the stable notification id and its batch state. */
type LedgerEntry = readonly [id: string, state: LedgerState]

/**
 * Parse stored JSON into entries, tolerating corruption and unknown states.
 * @param raw - the stored string, or null when nothing was persisted.
 * @returns parsed entries in stored order (possibly empty).
 */
export function parseLedger(raw: string | null): LedgerEntry[] {
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const entries: LedgerEntry[] = []
    for (const item of parsed) {
      if (!Array.isArray(item) || item.length !== 2) continue
      const [id, state] = item as unknown[]
      if (typeof id !== 'string' || id === '') continue
      if (state !== 'shown' && state !== 'alive' && state !== 'closed') continue
      entries.push([id, state])
    }
    return entries
  } catch {
    return []
  }
}

/**
 * Fold stored entries into the live ids one batch should withdraw, keeping the
 * latest state per id and dropping closed ones. Over-cap survivors are folded
 * away so the ledger can never grow without bound.
 * @param entries - parsed entries in stored order.
 * @param cap - the maximum number of live ids to keep.
 * @returns the survivors plus how many were dropped.
 */
export function foldLedger(entries: readonly LedgerEntry[], cap: number = LEDGER_CAP): LedgerSnapshot {
  const latest = new Map<string, LedgerState>()
  for (const [id, state] of entries) latest.set(id, state)
  const live = [...latest].filter(([, state]) => state !== 'closed').map(([id]) => id)
  const kept = live.length <= cap ? live : live.slice(live.length - cap)
  return { live: kept, dropped: live.length - kept.length }
}

/** Serialize entries, dropping closed ones and trimming the oldest over-cap ids. */
function serialize(entries: readonly LedgerEntry[], cap: number): string {
  const open = entries.filter(([, state]) => state !== 'closed')
  const kept = open.length <= cap ? open : open.slice(open.length - cap)
  return JSON.stringify(kept.map(([id, state]) => [id, state]))
}

/**
 * Create the ledger over one storage key.
 * @param storage - persistent storage, or undefined when unavailable.
 * @param key - the storage key holding the entries.
 * @returns the ledger API.
 */
export function createLedger(storage: LedgerStorage | undefined, key: string): Ledger {
  const states = new Map<string, LedgerState>()
  const read = (): LedgerEntry[] => parseLedger(storage?.getItem(key) ?? null)
  const write = (entries: readonly LedgerEntry[]): void => {
    if (storage === undefined) return
    try {
      storage.setItem(key, serialize(entries, LEDGER_CAP))
    } catch {
      // Quota or private-mode failures must not break notifications.
    }
  }
  /** Merge the in-memory states into the stored entries (in-memory wins). */
  const merged = (): LedgerEntry[] => {
    const order: string[] = []
    const latest = new Map<string, LedgerState>()
    for (const [id, state] of read()) {
      if (!latest.has(id)) order.push(id)
      latest.set(id, state)
    }
    for (const [id, state] of states) {
      if (!latest.has(id)) order.push(id)
      latest.set(id, state)
    }
    return order.map(id => [id, latest.get(id) ?? 'alive'] as LedgerEntry)
  }
  return {
    show(id) {
      states.set(id, 'shown')
      write(merged())
    },
    closeState(ids) {
      for (const id of ids) states.set(id, 'closed')
      write(merged())
    },
    close(id) {
      states.set(id, 'closed')
      write(merged())
    },
    survivors() {
      return foldLedger(read())
    },
    prune(live) {
      const keep = new Set(live)
      const entries = read().filter(([id]) => keep.has(id))
      states.clear()
      write(entries)
    },
    clear() {
      states.clear()
      write([])
    },
  }
}
