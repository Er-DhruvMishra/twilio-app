# Changelog

All notable changes to Virtual Phone OS. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — this is a
greenfield project so everything is technically `Added` until we cut a
1.0 tag.

## [Unreleased]

### Added

- **Phone**: speed-dial slots 1-9 (long-press dial keys), last-dialed
  recall on green button when buffer is empty, in-call recording
  toggle (mid-call Twilio REST), in-call speaker toggle (HTMLMediaElement
  `setSinkId`)
- **Diagnostics app** at `/diagnostics` — mic level meter, camera
  preview, speaker tone test, device enumeration, browser context
- **Profile**: personal phone number field
- **List shortcuts**: Call / SMS / Save quick-actions on every row in
  Phone history, Voicemail, Messages threads (via shared `RowActions`
  component)
- **WhatsApp brand icon** with proper `evenodd` fill
- **Real-time events** for new modules: `LookupCompleted`,
  `FaxReceived`, `FaxStatusUpdated`, `MailReceived`, `MailStatusUpdated`,
  `ConversationMessageReceived`, `VideoRoomEvent`
- **Web Push notifications** for Fax / Mail / Conversations + service
  worker click-routing for each new type
- **Mail attachments** on outbound (10 files / 25 MB each / 28 MB
  combined)
- **Mail templates + bulk campaigns** with audience picker (tags ∪
  contacts), variable interpolation `{{name}}` / `{{email}}`,
  auto-poll progress while running
- **Audit log viewer** at `/settings/audit-log`
- **Per-module debug log toggle** at `/settings/debug` — daily-rotating
  log file with auto-redacted secrets
- **`StatusBar`** wired to real device data: battery (Battery API),
  signal bars (NetworkInformation API), Twilio reachability cloud
  (cached `Account.fetch` health probe)
- **Cross-origin `phpdebugbar` warning** silenced via XHR
  `getResponseHeader` wrapper for non-same-origin responses (Twilio CDN,
  etc.)

### Changed

- Admin role now sees all communication data (Calls / Messages /
  Voicemails / Contacts / Fax / Mail / Conversations / Video) via a
  shared `ScopedToUser` trait — settings stay strictly per-user
- Per-agent permission editor on Settings → Team replaces the role-only
  dropdown
- Fax provider switched from Twilio Programmable Fax (EOL'd 2021-12-17)
  to fax.plus REST v3
- Lookup auto-trigger never fires for known contacts; never on outbound
  to known contacts
- Twilio access token now multi-grant: VoiceGrant + ChatGrant +
  VideoGrant on a single JWT, conditional on the user's permissions
- Twilio reachability check uses `Balance.fetch` (works with Standard
  API Keys) instead of `Account.fetch` (which 401s with API Keys)

### Fixed

- `caller_type` enum truncation on Lookup writes (Twilio sometimes
  returns `undetermined` for unverified numbers — now coerced to null)
- WhatsApp + Messenger Home tile icons (broken stroke paths replaced
  with proper filled silhouettes)
- Disconnect icon on `ActiveCallBar` (rotated handset, crisp at 12px)
- Dial icon in Contacts list (consistent with Twilio receiver glyph)
- Dialer contact suggest returning empty: `/api/contacts/suggest` was
  gated by `can:manage-contacts`, blocking agents with only
  `make-calls` — now open to any authed user (still per-user-scoped)
- Module debug log "always empty": tail endpoint was reading
  `module-debug.log` but Laravel's `daily` driver writes
  `module-debug-YYYY-MM-DD.log` — endpoint now finds the most-recent
  rotated file
- `phpdebugbar*` CORS warnings: `ExposeDebugbarHeaders` middleware
  whitelists same-origin reads; client-side patch handles cross-origin

## [Initial scaffold]

The original build phase shipped:

- Phone dialer (Twilio Voice JS) with DTMF + T9 contact suggestions
- SMS / MMS with auto-reply rules + bulk campaigns
- Voicemail with transcript + send-voicemail
- Contacts with CSV import/export, tags, T9 search
- Lookup module (Twilio Lookup v2, source-tracked history)
- Billing dashboard (Twilio Usage + Balance)
- Mail module (SendGrid full feature set)
- Conversations: Chat / RCS / WhatsApp / Messenger
- Video module (Twilio Video group rooms + recording)
- Per-channel real-time updates via Reverb + Web Push
- Settings hub: Twilio config, Number picker, Call settings, Blocklist,
  Notifications, Theme, Auto-reply, Templates, IVR builder, Routing
  rules, Team, Analytics
- RBAC: admin + agent roles, 29 permissions
- ngrok-based dev workflow with `php artisan dev:start` wrapper
