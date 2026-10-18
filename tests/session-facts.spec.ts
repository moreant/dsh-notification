/**
 * The session-fact readers: which session is in view, and which sessions are
 * waiting for the user — across the 0.1.x and 0.2.x session surfaces.
 */
import { describe, expect, it } from 'vitest'
import { asPendingKind, pendingKindOf, viewedSession, type UiSessionFacts } from '../src/client/session-facts.ts'

const observable = <T>(value: T): { getSnapshot(): T } => ({ getSnapshot: () => value })

describe('asPendingKind', () => {
  it('keeps the three notifiable kinds', () => {
    expect(asPendingKind('approval')).toBe('approval')
    expect(asPendingKind('question')).toBe('question')
    expect(asPendingKind('plan-review')).toBe('plan-review')
  })

  it('drops unknown and absent discriminators', () => {
    expect(asPendingKind('something-else')).toBeUndefined()
    expect(asPendingKind(undefined)).toBeUndefined()
  })
})

describe('viewedSession', () => {
  it('uses the 0.1.x selected session when the snapshot carries one', () => {
    const state = { byId: {}, current: 'a' }
    expect(viewedSession(state, 'a')).toBe('a')
    expect(viewedSession(state, 'b')).toBe('a')
  })

  it('treats the main pane retention as in view on 0.2.x', () => {
    const state = { byId: { a: { retainedBy: { mainView: 1 } }, b: { retainedBy: { sidebar: 2 } } } }
    expect(viewedSession(state, 'a')).toBe('a')
    expect(viewedSession(state, 'b')).toBeUndefined()
  })

  it('reads an absent retention as not in view', () => {
    expect(viewedSession({ byId: { a: {} } }, 'a')).toBeUndefined()
    expect(viewedSession({ byId: {} }, 'missing')).toBeUndefined()
  })
})

describe('pendingKindOf', () => {
  it('prefers the 0.1.1 list row', () => {
    const state = { byId: { a: { pendingInteraction: 'approval' as const } } }
    const uiSession: UiSessionFacts = { sessionStatus: observable(new Map([['a', { pendingInteraction: { kind: 'question' } }]])) }
    expect(pendingKindOf(state, uiSession, 'a')).toBe('approval')
  })

  it('reads the 0.2.x session status map', () => {
    const state = { byId: { a: {} } }
    const uiSession: UiSessionFacts = { sessionStatus: observable(new Map([['a', { pendingInteraction: { kind: 'plan-review' } }]])) }
    expect(pendingKindOf(state, uiSession, 'a')).toBe('plan-review')
  })

  it('falls back to the 0.1.2 pending observable', () => {
    const state = { byId: { a: {} } }
    const uiSession: UiSessionFacts = { pendingInteractions: observable(new Map([['a', { kind: 'question' }]])) }
    expect(pendingKindOf(state, uiSession, 'a')).toBe('question')
  })

  it('ignores unknown kinds and absent services', () => {
    const state = { byId: { a: {} } }
    const uiSession: UiSessionFacts = { sessionStatus: observable(new Map([['a', { pendingInteraction: { kind: 'nope' } }]])) }
    expect(pendingKindOf(state, uiSession, 'a')).toBeUndefined()
    expect(pendingKindOf(state, undefined, 'a')).toBeUndefined()
  })

  it('prefers the status map over the legacy observable when both exist', () => {
    const state = { byId: { a: {} } }
    const uiSession: UiSessionFacts = {
      sessionStatus: observable(new Map([['a', { pendingInteraction: { kind: 'approval' } }]])),
      pendingInteractions: observable(new Map([['a', { kind: 'question' }]])),
    }
    expect(pendingKindOf(state, uiSession, 'a')).toBe('approval')
  })
})
