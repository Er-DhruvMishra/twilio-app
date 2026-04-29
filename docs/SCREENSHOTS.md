# Screenshot capture guide

This project ships without screenshots — they need to be captured per
deployment because branding / numbers / contact data is unique. Save
each PNG at the path listed; `README.md` references them via relative
paths under `docs/screenshots/`.

## Capture standards

- **Browser**: Chrome or Edge, latest, 1280×720 viewport (scale to
  match the mobile-style frame).
- **Format**: PNG, RGB (no alpha). 1× resolution is fine; the README
  doesn't upscale.
- **Privacy**: scrub or mask any real phone numbers, account SIDs,
  fax.plus IDs, or customer names before committing. The audit-log
  page in particular contains real user activity.
- **Theme**: dark (default). Use Settings → Theme & display → Dark if
  yours is auto.

A simple way to capture exactly the phone-frame area:

1. Open DevTools → Toggle device toolbar → "Responsive" 420×900
2. Use the browser's "Capture node screenshot" on the
   `.phone-shell-frame` div (Chrome: Ctrl+Shift+P → "Capture node
   screenshot")

## Capture list

Twelve screenshots cover the full feature surface. The file paths
match what `README.md` already links to.

| Save as | URL | Setup |
|---|---|---|
| `home.png` | `/home` | Logged in as admin with several apps visible (badges on Phone / Messages / Voicemail are nice if you have unread items). |
| `phone-dialer.png` | `/phone` | Type a few digits and let the T9 suggestions panel appear under the readout. Last-dialed hint visible in the readout when buffer is empty also works. |
| `phone-incall.png` | `/phone/in-call` | Place a real call so the screen renders. Activate Recording and Speaker so the status pills both show. |
| `messages-thread.png` | `/messages/{thread}` | An active SMS thread with a few outbound + inbound bubbles. |
| `mail-compose.png` | `/mail/compose` | Subject + body filled, 2 attachments showing in the chip list, total size pill visible. |
| `fax-send.png` | `/fax/send` | Recipient + PDF picked, send button label says "Send fax". |
| `lookup-history.png` | `/lookup` | At least 3 historical lookups visible in the table with mixed sources (manual + auto). |
| `settings-hub.png` | `/settings` | The full settings list with all sections visible. Scroll to top before capturing. |
| `diagnostics.png` | `/diagnostics` | Mic test + camera test both running so the level meter shows green and the video preview is live (use a still image if you'd rather not capture yourself). |
| `team.png` | `/settings/team` | Team page with 2-3 members, Permissions modal open on one of them showing the checkbox grid. |
| `analytics.png` | `/settings/analytics` | 30-day window, Voice tab selected, sparkline + top-contacts populated. |
| `debug.png` | `/settings/debug` | A few module flags toggled on, the live tail showing 5-10 entries. |

## Optional bonus shots

Useful if you want a deeper gallery — not referenced from `README.md`
by default.

| Save as | URL | Description |
|---|---|---|
| `home-incoming-call.png` | any page | Trigger an inbound call so the `IncomingCallSheet` overlay covers the screen. |
| `mail-thread.png` | `/mail/{id}` | A long mail thread with attachments and a reply composer at the bottom. |
| `chat-thread.png` | `/chat/{id}` | Conversation view with typing indicator + read receipts visible. |
| `video-room.png` | `/video/{id}` | Video room with 2 participant tiles + control bar. |
| `ivr-editor.png` | `/settings/ivr/{id}` | React Flow canvas with 4-5 connected nodes. |
| `audit-log.png` | `/settings/audit-log` | Audit log filtered by `view-as-admin` source, several entries visible. |

## Adding to README

The README's gallery already references these by relative path. As soon
as you commit PNGs at the listed paths, the gallery will render on
GitHub / GitLab / wherever you host the repo.

If you add bonus shots, append them to the gallery section in the README.

## Sharing screenshots externally

When pasting into a PR / blog post, prefer raw GitHub URLs (e.g.
`https://raw.githubusercontent.com/<org>/<repo>/main/docs/screenshots/home.png`)
since the markdown `![]()` references in `README.md` don't resolve
once the file is removed from local context.
