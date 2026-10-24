/**
 * The delivered-notification ledger: parse/fold tolerance, the batch states
 * (`shown` → `alive` → `closed`), the cap, and the survivor fold a fresh page
 * uses to withdraw what a previous page left in Notification Center.
 */
import { describe, expect, it } from 'vitest'
import { LEDGER_CAP, createLedger, foldLedger, parseLedger, type LedgerStorage } from '../src/client/ledger.ts'

const KEY = 'dsh-notification.delivered'

function memoryStorage(entries: Record<string, string> = {}): LedgerStorage & { readonly map: Map<string, string> } {
  const map = new Map(Object.entries(entries))
  return {
    map,
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value) },
  }
}

describe('parseLedger', () => {
  it('returns nothing for an absent or corrupt entry', () => {
    expect(parseLedger(null)).toEqual([])
    expect(parseLedger('not json')).toEqual([])
    expect(parseLedger('{"a":1}')).toEqual([])
  })

  it('drops malformed rows and unknown states', () => {
    expect(parseLedger(JSON.stringify([
      ['a#1', 'shown'],
      ['b#1', 'mystery'],
      ['', 'alive'],
      [42, 'alive'],
      ['c#1'],
      ['d#1', 'alive'],
    ]))).toEqual([['a#1', 'shown'], ['d#1', 'alive']])
  })
})

describe('foldLedger', () => {
  it('keeps the latest state per id and drops closed ones', () => {
    const snapshot = foldLedger([['a#1', 'shown'], ['b#1', 'alive'], ['a#1', 'closed']])
    expect(snapshot).toEqual({ live: ['b#1'], dropped: 0 })
  })

  it('folds over-cap survivors away from the oldest end', () => {
    const entries = Array.from({ length: 5 }, (_, index) => [`n#${index}`, 'shown'] as const)
    expect(foldLedger(entries, 2)).toEqual({ live: ['n#3', 'n#4'], dropped: 3 })
  })
})

describe('createLedger', () => {
  it('records a shown notification and reports it as a survivor', () => {
    const storage = memoryStorage()
    const ledger = createLedger(storage, KEY)
    ledger.show('dsh-notification-completion#1')
    expect(ledger.survivors().live).toEqual(['dsh-notification-completion#1'])
    expect(JSON.parse(storage.map.get(KEY) ?? '[]')).toEqual([['dsh-notification-completion#1', 'shown']])
  })

  it('marks a batch closed so the next page does not withdraw it again', () => {
    const storage = memoryStorage()
    const ledger = createLedger(storage, KEY)
    ledger.show('a#1')
    ledger.show('b#1')
    ledger.closeState(['a#1', 'b#1'])
    expect(ledger.survivors()).toEqual({ live: [], dropped: 0 })
    // Closed entries are not stored at all, so the ledger cannot grow.
    expect(JSON.parse(storage.map.get(KEY) ?? '[]')).toEqual([])
  })

  it('closes one id without touching its siblings', () => {
    const storage = memoryStorage()
    const ledger = createLedger(storage, KEY)
    ledger.show('a#1')
    ledger.show('b#1')
    ledger.close('a#1')
    expect(ledger.survivors().live).toEqual(['b#1'])
  })

  it('prunes everything the caller did not keep', () => {
    const storage = memoryStorage()
    const ledger = createLedger(storage, KEY)
    ledger.show('a#1')
    ledger.show('b#1')
    ledger.prune(['b#1'])
    expect(ledger.survivors().live).toEqual(['b#1'])
  })

  it('clears the whole ledger', () => {
    const storage = memoryStorage()
    const ledger = createLedger(storage, KEY)
    ledger.show('a#1')
    ledger.clear()
    expect(ledger.survivors()).toEqual({ live: [], dropped: 0 })
  })

  it('survives a storage that refuses writes', () => {
    const storage: LedgerStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('quota exceeded') },
    }
    const ledger = createLedger(storage, KEY)
    expect(() => { ledger.show('a#1') }).not.toThrow()
  })

  it('works without storage', () => {
    const ledger = createLedger(undefined, KEY)
    ledger.show('a#1')
    expect(ledger.survivors()).toEqual({ live: [], dropped: 0 })
  })

  it('caps the whole ledger, including entries inherited from earlier pages', () => {
    const inherited = Array.from({ length: LEDGER_CAP }, (_, index) => [`old#${index}`, 'alive'] as const)
    const storage = memoryStorage({ [KEY]: JSON.stringify(inherited) })
    const ledger = createLedger(storage, KEY)
    for (let index = 0; index < 10; index += 1) ledger.show(`n#${index}`)
    const stored = JSON.parse(storage.map.get(KEY) ?? '[]') as unknown[]
    expect(stored).toHaveLength(LEDGER_CAP)
    expect(stored[0]).toEqual([`old#10`, 'alive'])
    expect(stored[LEDGER_CAP - 1]).toEqual(['n#9', 'shown'])
  })

  it('reads states written by a previous page (the alive hand-off)', () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify([['old#1', 'alive'], ['gone#1', 'closed']]) })
    const ledger = createLedger(storage, KEY)
    expect(ledger.survivors().live).toEqual(['old#1'])
    // A later batch keeps the previous page's open entries in order.
    ledger.show('new#1')
    expect(JSON.parse(storage.map.get(KEY) ?? '[]')).toEqual([['old#1', 'alive'], ['new#1', 'shown']])
  })
})
