/**
 * Client notification helpers: localized titles, body selection, the
 * permission/background gate, and the per-session grouping tag.
 */
import { describe, expect, it } from 'vitest'
import {
  COMPLETION_TAG_PREFIX,
  bodyText,
  closeNotifications,
  createBrowserNotification,
  idTag,
  isCompletionTag,
  notificationId,
  notificationTag,
  pendingNotificationTag,
  pendingTitleKey,
  restoreNotification,
  shouldShow,
  titleKey,
} from '../src/client/notifier.ts'

describe('titleKey', () => {
  it('maps every reason to its title key', () => {
    expect(titleKey('completed')).toBe('notify.titleCompleted')
    expect(titleKey('error')).toBe('notify.titleError')
    expect(titleKey('aborted')).toBe('notify.titleAborted')
    expect(titleKey('blocked')).toBe('notify.titleBlocked')
    expect(titleKey('max-tokens')).toBe('notify.titleMaxTokens')
  })
})

describe('bodyText', () => {
  it('trims the reply snippet', () => {
    expect(bodyText('  done  ', 'fallback')).toBe('done')
  })

  it('falls back when the reply is empty', () => {
    expect(bodyText('   ', 'fallback')).toBe('fallback')
  })
})

describe('shouldShow', () => {
  it('requires granted permission', () => {
    expect(shouldShow('default', false, true)).toBe(false)
    expect(shouldShow('denied', false, true)).toBe(false)
    expect(shouldShow('granted', false, true)).toBe(true)
  })

  it('honors the background-only gate', () => {
    expect(shouldShow('granted', true, false, 'session-a', 'session-a')).toBe(false)
    expect(shouldShow('granted', true, true, 'session-a', 'session-a')).toBe(true)
    expect(shouldShow('granted', false, false, 'session-a', 'session-a')).toBe(true)
  })

  it('notifies for another session while DSH is visible', () => {
    expect(shouldShow('granted', true, false, 'session-a', 'session-b')).toBe(true)
    expect(shouldShow('granted', true, false, 'session-a', undefined)).toBe(true)
  })
})

describe('notificationTag', () => {
  it('mints a distinct tag per turn so a later completion is not a silent replacement', () => {
    expect(COMPLETION_TAG_PREFIX).toBe('dsh-notification-completion')
    expect(notificationTag('s1', 1)).toBe('dsh-notification-completion-s1-1')
    expect(notificationTag('s1', 1)).not.toBe(notificationTag('s1', 2))
    expect(notificationTag('s1', 1)).not.toBe(notificationTag('s2', 1))
  })
})

describe('isCompletionTag', () => {
  it('recognizes completion tags and nothing else', () => {
    expect(isCompletionTag(notificationTag('s1', 3))).toBe(true)
    expect(isCompletionTag('dsh-notification-pending-s1-1')).toBe(false)
    expect(isCompletionTag('dsh-notification-test-1700000000000')).toBe(false)
    expect(isCompletionTag('dsh-notification-completion')).toBe(false)
  })
})

describe('notificationId / idTag', () => {
  it('round-trips a per-turn completion tag', () => {
    const completion = notificationTag('s1', 7)
    const id = notificationId(completion, 7)
    expect(id).toBe('dsh-notification-completion-s1-7#7')
    expect(idTag(id)).toBe(completion)
  })

  it('keeps a per-interaction tag intact', () => {
    const id = notificationId('dsh-notification-pending-s1-2', 3)
    expect(idTag(id)).toBe('dsh-notification-pending-s1-2')
  })

  it('rejects ids without a tag', () => {
    expect(idTag('alpha')).toBeUndefined()
    expect(idTag('#1')).toBeUndefined()
  })
})

describe('restoreNotification', () => {
  it('re-points the entry through its tag', () => {
    const constructed: Array<{ title: string; options: NotificationOptions | undefined }> = []
    const api = class {
      static permission = 'granted'
      constructor(title: string, options?: NotificationOptions) { constructed.push({ title, options }) }
    } as unknown as typeof Notification
    expect(restoreNotification(api, 'dsh-notification-completion#4')).toBeDefined()
    expect(constructed).toEqual([{ title: '', options: { tag: 'dsh-notification-completion' } }])
  })

  it('returns undefined without an API, a tag, or a working constructor', () => {
    expect(restoreNotification(undefined, 'x#1')).toBeUndefined()
    expect(restoreNotification(class {} as unknown as typeof Notification, 'notag')).toBeUndefined()
    const broken = class { constructor() { throw new Error('unavailable') } } as unknown as typeof Notification
    expect(restoreNotification(broken, 'x#1')).toBeUndefined()
  })
})

describe('closeNotifications', () => {
  it('closes every recorded handle and counts successes', () => {
    const closed: string[] = []
    const api = class {
      static permission = 'granted'
      private readonly tag: string | undefined
      constructor(_title: string, options?: NotificationOptions) { this.tag = options?.tag }
      close(): void {
        if (this.tag === 'refuse') throw new Error('cannot close')
        closed.push(this.tag ?? '')
      }
    } as unknown as typeof Notification
    const count = closeNotifications(api, ['a#1', 'refuse#1', 'b#1', 'no-tag'])
    expect(count).toBe(2)
    expect(closed).toEqual(['a', 'b'])
  })

  it('is a no-op without an API', () => {
    expect(closeNotifications(undefined, ['a#1'])).toBe(0)
  })
})

describe('pendingNotificationTag', () => {
  it('keeps each pending interaction distinct', () => {
    expect(pendingNotificationTag('session-1', 2)).toBe('dsh-notification-pending-session-1-2')
  })
})

describe('pendingTitleKey', () => {
  it('maps each pending kind', () => {
    expect(pendingTitleKey('approval')).toBe('notify.titleApproval')
    expect(pendingTitleKey('question')).toBe('notify.titleQuestion')
    expect(pendingTitleKey('plan-review')).toBe('notify.titlePlanReview')
  })
})

describe('createBrowserNotification', () => {
  it('reports unavailable and ungranted browser surfaces', () => {
    expect(createBrowserNotification(undefined, 'test', {})).toEqual({
      ok: false,
      message: 'The Notification API is unavailable in this browser context.',
    })
    const ungranted = class { static permission = 'default' } as unknown as typeof Notification
    expect(createBrowserNotification(ungranted, 'test', {})).toEqual({
      ok: false,
      message: 'Notification permission is not granted.',
    })
  })

  it('returns the created notification', () => {
    let created: object | undefined
    const api = class {
      static permission = 'granted'
      onclick = null
      onerror = null
      constructor() { created = this }
    } as unknown as typeof Notification
    const result = createBrowserNotification(api, 'test', { body: 'body' })
    expect(result).toEqual({ ok: true, notification: created })
  })

  it('contains constructor failures', () => {
    const api = class {
      static permission = 'granted'
      constructor() { throw new Error('system notifications unavailable') }
    } as unknown as typeof Notification
    expect(createBrowserNotification(api, 'test', {})).toEqual({
      ok: false,
      message: 'system notifications unavailable',
    })
  })
})
