# dsh-notification

Desktop notifications for the DeepSeek Harness web GUI. When a session finishes a turn, the browser shows a system notification (via the `Notification` API), so you can switch tabs and still know when DSH is done. Per-outcome toggles and include/exclude keyword rules control exactly which completions notify.

No harness change is needed: the host contributes a session projection (a bounded summary of each session's last completed turn), and the client watches the session list's completion reminder and applies its own persisted preferences.

```
host:  notification projection (last turn's reason/text/tools) --session/projection--> browser
client: session list completion reminder (live, dedup) + persisted settings
        -> permission + current-session visibility gate
        -> new Notification("DSH finished", { body: "deploy done" })
```

## Install

```sh
dsh plugin --profile web add https://github.com/moreant/dsh-notification/archive/refs/tags/v0.1.7.tar.gz
```

Restart the web server so the host half and the served client bundle pick up the plugin. The default `dsh web` profile has the required client composition (the session list, the settings shell, and locale).

`0.1.7` restores the alert for every completion: `0.1.6` gave every completion one shared tag, and Chromium (macOS in particular) treats a later same-tag notification as a **silent replacement** — the entry in Notification Center is rewritten in place, with no banner and no sound (`renotify` is ignored on macOS), which reads as notifications arriving late or not at all. Each completion now carries its own tag (the system treats it as new and alerts), and the plugin withdraws the previous completion from its delivery ledger right before showing the next one, so Notification Center still keeps a single entry.

`0.1.6` fixes the batch replay of stale notifications after login or display wake: each delivery is recorded and the record is withdrawn on page hide, lock, sleep, sign-out, shutdown, and the next page load.

Version `0.1.5` supports both the 0.1.x and 0.2.x Harness client layouts and projection contracts: waiting interactions are read from `uiSession.sessionStatus` on 0.2.x (falling back to the 0.1.2 `pendingInteractions` observable and the 0.1.1 list row), and the "in view" gate uses the list snapshot's `current` on 0.1.x or the row's `retainedBy.mainView` retention on 0.2.x.

Install by name only if this package owns that registry name. The `dsh-notification` name on npm belongs to an unrelated project, so installing `dsh-notification` from a registry installs that one instead — use the tarball URL above.

The settings section lives under **Settings > Notifications**.

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| Enable notifications | on | Master switch; off stops every notification while keeping rules. |
| Notify on completed / error / aborted / blocked / token limit | completed + error on, rest off | Which turn-end reasons notify (the host projection reports the reason). |
| Keyword rules | none | Include/exclude filters matched against the session title, the turn's reply text, and its tool names. Include rules: at least one must match. Exclude rules: a match suppresses. Rules support literal or regex matching with an optional case-sensitive flag. |
| Require manual dismiss | off | The notification stays until dismissed. |
| Only notify when the task is out of view | on | Suppress a notification only when its session is currently in view. A completion still notifies while the page is hidden or while another session/workspace is open. Turn it off to notify even for the session being watched. Completions always keep a single entry. |
| Clear notifications before lock or sleep | on | Withdraw delivered notifications when the page hides, the screen locks, the display sleeps, the user signs out, or the machine shuts down, so macOS does not replay the stale ones on wake or in a batch seconds after the next login. A display-only sleep keeps the newest completion for reading on wake; a manual lock withdraws everything (DSH re-arms interactions that still wait). |

Preferences persist in the browser (localStorage). The section also grants browser permission and sends a test notification.

Every completion carries its own notification tag (a later same-tag notification would be replaced silently and never alert), and the previous completion is withdrawn right before the next one is shown — so Notification Center still keeps a single entry instead of a growing timeline; each delivery is recorded in a local ledger (`dsh-notification.delivered`) and withdrawn at the moments above or on the next page load.

## Configuration

Host-side tunables live on the plugin row in `cordis.yml`:

```yaml
- id: dsh-notification
  name: dsh-notification
  config:
    maxBodyChars: 400      # projection body budget; longer replies are ellipsized host-side
```

## Model experience

| Aspect | Effect |
| --- | --- |
| Token cost | None — notifications are UI-only and never enter a request. |
| Tool calls | None — the model gets no new tool. |
| Session log | Unchanged — the projection reads the existing log and adds no events. |
| Prompt | Unchanged — no system-prompt section is registered. |

## Permission boundary

- The host folds a pure projection over the session log (turn reason, bounded reply text, tool names) and the projection seam delivers it to the browser; the plugin writes nothing to the log and registers no model-facing tools.
- The client watches the session list's completion reminder (a live "finished while not selected" edge the runtime already computes) and shows a notification only when the user has granted Notification permission.
- Rule matching runs client-side against the projected content; the reply body never exceeds `maxBodyChars`.

## Development

```sh
pnpm install            # links the sibling dsh checkout for build and tests
pnpm run check          # typecheck + tests + build
pnpm run test           # vitest (host projection + composition, client decision/runner/helpers/section)
pnpm run build          # esbuild host/client/invariant bundles + tsc declarations
```

The repo expects the harness checkout at `../dsh` for the dev-time `link:` resolutions. The composition spec boots the real `SessionStore` and `SessionProjectionRegistry` and proves the fold.

## Known limitations

- Notifications require the page to be open (the browser shows them while it is hidden, but not after the tab is closed) and Notification permission granted; a denied site permission cannot be overridden from inside the page.
- Notifications fire once per finished turn (a running→idle edge on any session); a completion that happened while the page was disconnected is not re-notified on reconnect.
- The rule subject is the session title plus the last turn's reply text and tool names — earlier turns are not matched.
- Notification body is a flat text snippet; the click action only focuses the window (no deep link to the turn).
- Withdrawal relies on a browser reusing the entry for a known tag (`new Notification(…, { tag })` then `close()`); a kernel that does not support it may leave the old entry in Notification Center, in which case shortening the app's retention in System Settings > Notifications is the fallback.

## License

MIT
