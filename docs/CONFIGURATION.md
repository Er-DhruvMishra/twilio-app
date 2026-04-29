# Configuration guide

All vendor credentials are stored in the database (encrypted with the
Laravel `encrypted` cast bound to `APP_KEY`), not in `.env`. Configure
them through the in-app settings pages — listed in the order you should
walk on first run.

> **Rotate `APP_KEY` carefully**: doing so invalidates every encrypted
> value in the DB, including these credentials. You'll need to re-enter
> them through the UI after rotation. Do not rotate casually.

## 1. Twilio account (required)

**Page**: Settings → Twilio · **Permission**: `manage-twilio`
([Settings/Twilio.tsx](../resources/js/Pages/Settings/Twilio.tsx))

What you need:

- **Account SID** — from https://console.twilio.com (top-right)
- **Auth Token** — same page, click the eye icon to reveal

Paste both, click **Save**. The form does a live verification by hitting
`Account.fetch` with the credentials before persisting; bad values are
rejected with a clear error.

The form auto-creates a Twilio API Key (SK…) on save so subsequent calls
use the more revocable key-based auth instead of the Auth Token directly.
The Account SID + Auth Token stay in DB only as a fallback for endpoints
that require master-key auth.

## 2. Phone number (required for Voice + SMS)

**Page**: Settings → Phone Numbers · **Permission**: `manage-twilio`

Two flows:

### A. Use an existing number you own

The page lists numbers attached to your Twilio account. Pick one, click
**Use**, the app PATCHes the IncomingPhoneNumber resource to point
`voiceUrl` / `smsUrl` / `statusCallback` at `WEBHOOK_BASE_URL` (your
ngrok URL in dev, your `APP_URL` in prod).

### B. Search + buy a new number

Enter a country (defaults to US) and area code. The app calls
`AvailablePhoneNumbers` and lists matches with their capability chips
(voice / sms / mms / fax). Click **Buy** — Twilio charges you the
monthly fee, the number is added to your account, and webhooks are
auto-configured.

### TwiML App auto-create

If you don't have a TwiML App yet, the app creates one on first save
named "Virtual Phone OS — Voice JS" and stores its SID. The Voice JS SDK
needs this App SID for outbound browser calls.

### After ngrok URL changes

In dev, ngrok's free tier issues a new URL on every restart. Run:

```bash
php artisan twilio:sync-webhooks
```

This re-PATCHes your number's webhook URLs to the current
`WEBHOOK_BASE_URL`. The `dev:start` wrapper does this automatically.

## 3. Web Push (recommended)

**Page**: Settings → Notifications · **Permission**: any authed user
([Settings/Notifications.tsx](../resources/js/Pages/Settings/Notifications.tsx))

Click **Enable**. The page calls
`navigator.serviceWorker.register('/sw.js')`, requests browser
permission, subscribes to the VAPID public key embedded in the page
(`VAPID_PUBLIC_KEY` from `.env`), and posts the subscription to
`/api/push/subscribe`.

Click **Send test** — an OS-level notification should fire within ~2s.

This is **per-browser per-device**. An agent who uses Chrome at the
office and Safari at home subscribes both.

### iOS caveats

iOS Web Push requires:
- iOS 16.4+
- The PWA installed via "Add to Home Screen" from Safari
- HTTPS (no mixed content)

Pre-iOS-16.4 devices won't get push at all; they'll only see Reverb
real-time updates while the tab is open.

## 4. Mail (SendGrid) — optional

**Page**: Settings → Mail · **Permission**: `manage-twilio`
([Settings/MailConfig.tsx](../resources/js/Pages/Settings/MailConfig.tsx))

What you need:

- **API Key** — SendGrid Console → Settings → API Keys → Create. Use
  "Full Access" or specifically `Mail Send` + `Templates` + `Stats` +
  `Suppressions` + `Inbound Parse`.
- **Webhook Verify Key** (optional but strongly recommended) — Settings
  → Mail Settings → Event Webhook → enable Signed Event Webhook → copy
  the public key. Without it, anyone can post fake events.
- **From email** — your verified single-sender or domain.
- **From name** — display name.
- **Inbound Parse host** — only if you want to receive mail. See below.

### Setting up Inbound Parse for received mail

1. Buy / configure a domain you control (e.g. `parse.example.com`).
2. Add an MX record:
   ```
   parse.example.com   MX   10   mx.sendgrid.net.
   ```
3. SendGrid Console → Settings → Inbound Parse → Add Host & URL:
   - Host: `parse.example.com`
   - URL: `https://your-app.example.com/webhooks/sendgrid/inbound`
   - Check "POST the raw, full MIME message"
4. Set `inbound_host` in the Mail config page to `parse.example.com`.

Email sent to `anything@parse.example.com` will now land in your Mail
inbox.

### Setting up Event Webhook for delivery / open / click stats

1. SendGrid Console → Settings → Mail Settings → Event Webhook →
   Configure → URL: `https://your-app.example.com/webhooks/sendgrid/events`
2. Check the events you want (delivered, opened, clicked, bounced are
   the most useful).
3. Enable Signed Event Webhook, copy the verification key into the Mail
   config page.

## 5. Fax (fax.plus) — optional

**Page**: Settings → Fax · **Permission**: `manage-twilio`
([Settings/FaxConfig.tsx](../resources/js/Pages/Settings/FaxConfig.tsx))

> **Why fax.plus and not Twilio?** Twilio Programmable Fax was End-of-
> Life on 2021-12-17; new accounts can't use it. fax.plus is Twilio's
> named successor partner.

What you need:

- **API Token** — fax.plus dashboard → Settings → API Tokens → Create
- **Webhook Signing Key** — same page → Webhooks → Generate Signing Key
- **From Number** — your fax.plus virtual fax number (E.164 format,
  e.g. `+14155551212`)

After saving, run:

```bash
php artisan faxplus:sync-webhooks
```

This PATCHes your fax.plus account's webhook config to point at
`{WEBHOOK_BASE_URL}/webhooks/faxplus/status` and
`{WEBHOOK_BASE_URL}/webhooks/faxplus/inbound`. Re-run when ngrok URL
changes (the `dev:start` wrapper does this automatically).

## 6. Conversations (Chat / RCS / WhatsApp / Messenger) — optional

**Page**: Settings → Conversations · **Permission**: `manage-twilio`
([Settings/ConversationsConfig.tsx](../resources/js/Pages/Settings/ConversationsConfig.tsx))

Twilio Conversations is one **service** with multiple **channel
bindings**. You enter the credentials once and pick which channels are
live.

### Service setup

1. Twilio Console → Conversations → Services → Create
2. Copy the Service SID (`IS…`) into the form.
3. Console → your service → Webhooks → set Post-event hook URL to
   `https://your-app.example.com/webhooks/twilio/conversations`.

### Per-channel setup

| Channel | Extra requirement |
|---|---|
| **Chat** (web↔web) | Nothing — uses identity-based participants. Just toggle Enable. |
| **RCS** | Twilio RCS Sender. Brand approval (~weeks) required. Paste Agent SID into "RCS Agent SID". |
| **WhatsApp** | Twilio WhatsApp Sender. Business Account verified with Meta (~days–weeks). Paste WA-from number (E.164) into "WhatsApp From". |
| **Facebook Messenger** | Twilio FB integration set up via Console (Pages permission needed). Paste Page ID into "Facebook Page ID". |

## 7. Video — optional

**Page**: Settings → Video · **Permission**: `manage-twilio`

Twilio Video doesn't need a dedicated service SID — it inherits from
your Twilio Account. The Settings/Video page is for default room
preferences (max participants, default record-on-connect).

Recordings cost $0.0015/min/track; compositions $0.01/min. The price is
shown in the room-create modal.

## 8. Speed dial — per user

**Page**: Settings → Call Settings · **Permission**: any authed user

Set numbers on slots 1–9. Long-pressing a digit on the dialer dials
that slot. Slot 0 is reserved for typing `+`.

## 9. Personal phone — per user

**Page**: Profile → Account · **Permission**: any authed user

Your own number, used for forwarding fallbacks and simultaneous-ring
lists. Format: `+E.164`.

## 10. Permissions per agent

**Page**: Settings → Team · **Permission**: `manage-team`
([Settings/Team.tsx](../resources/js/Pages/Settings/Team.tsx))

Each agent's row has a **Permissions** button. The modal shows all 29
permissions; ones derived from their role (`manage-contacts` for the
agent role, etc.) are locked-greyed; direct grants are toggleable.
Changes are audit-logged.

For a brand-new agent who only needs Phone + SMS, the role default is
already correct. Add `use-lookup`, `view-fax`, `send-mail`, etc.
individually as needed.

## Environment-only settings (advanced)

These live in `.env`, not in the UI:

| Var | Default | Purpose |
|---|---|---|
| `TWILIO_VALIDATE_SIGNATURE` | `false` (dev) / `true` (prod) | Reject webhook calls with bad signatures |
| `FAXPLUS_VALIDATE_SIGNATURE` | `true` | Same for fax.plus |
| `SENDGRID_VALIDATE_SIGNATURE` | `true` | Same for SendGrid |
| `WEBHOOK_BASE_URL` | (set by `dev:start`) | Public HTTPS URL Twilio / fax.plus / SendGrid post to |
| `DEBUGBAR_ENABLED` | `true` (dev) | Auto-off when `APP_DEBUG=false` |
| `DEBUGBAR_CAPTURE_AJAX` | `true` | XHR debug bar capture |
| `BROADCAST_CONNECTION` | `reverb` | Switch to `pusher` for managed scaling |
| `QUEUE_CONNECTION` | `database` | Switch to `redis` for production |

## Verification checklist

After all this, run through:

- [ ] **Voice outbound**: dial your mobile from the in-browser dialer
- [ ] **Voice inbound**: call the Twilio number from your mobile,
      `IncomingCallSheet` appears, accept, two-way audio
- [ ] **SMS**: text the number, thread updates live in Messages app
- [ ] **Mail outbound**: compose + send → recipient receives
- [ ] **Mail inbound**: send to `parse.<your-domain>` → row appears in
      Mail Threads
- [ ] **Fax outbound**: upload PDF + send → fax.plus dashboard shows it
- [ ] **Lookup**: search a US number, caller name + line type appear
- [ ] **Web Push**: switch tab, call number, OS notification fires
- [ ] **Settings → Debug logging**: toggle `voice` on, place a call,
      `storage/logs/module-debug-*.log` shows the TwiML round-trip with
      tokens redacted

If any check fails, the per-module debug log is your first stop. The
in-app **Settings → Audit log** shows every admin cross-user read +
permission grant for compliance review.
