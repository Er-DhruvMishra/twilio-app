# Module reference

Every app on the Home grid + every Settings page, indexed by route /
permission / data model / vendor. Use this as a quick lookup when
debugging or extending.

## Phone

| | |
|---|---|
| Web routes | `/phone` (dialer), `/phone/history`, `/phone/in-call` |
| API routes | `/api/calls`, `/api/calls/last-outbound`, `/api/calls/sync`, `/api/calls/{id}/reject\|tag`, `/api/calls/{sid}/recording/start\|stop`, `/api/recordings/{id}/audio`, `/api/twilio/token`, `/api/twilio/health` |
| Webhooks (Twilio) | `/webhooks/twilio/voice/incoming`, `/voice/outgoing`, `/voice/status`, `/voice/dial-status`, `/voice/recording`, `/voice/voicemail` |
| Permissions | `make-calls` |
| Models | `Call`, `Recording`, `Voicemail` |
| Services | `CallRoutingService`, `AccessTokenService`, `AgentRoutingService` |

Features: T9 contact suggestions, last-dialed recall, speed-dial slots
1-9 (long-press), DTMF, in-call mute / record / speaker / dialpad,
recording starts/stops via Twilio mid-call REST API.

## SMS / MMS

| | |
|---|---|
| Web routes | `/messages`, `/messages/compose`, `/messages/{thread}`, `/messages/bulk` |
| API routes | `/api/messages/threads`, `/api/messages/{thread}`, `/api/messages` (POST), `/api/messages/search`, `/api/bulk-sms/*` |
| Webhooks | `/webhooks/twilio/sms/incoming`, `/sms/status` |
| Permissions | `send-sms`, `send-bulk-sms`, `manage-templates` |
| Models | `Message`, `MessageMedia`, `SmsTemplate`, `BulkSmsCampaign`, `BulkSmsRecipient`, `AutoReplyRule` |
| Services | `SmsSender`, `AutoReplyEvaluator` |

Real-time delivery via `MessageReceived` event broadcast on
`private-user.{id}`. Bulk campaigns use the `DispatchBulkSmsBatch` job
chain at ~1 MPS pacing.

## Voicemail

| | |
|---|---|
| Web routes | `/voicemail`, `/voicemail/send` |
| API routes | `/api/voicemails`, `/api/voicemails/send`, `/api/voicemails/{id}/read`, `/api/voicemails/{id}` (DELETE) |
| Permissions | `view-voicemail` |
| Models | `Voicemail`, `Call`, `Recording` |

Inbound voicemail is captured by `<Record transcribe=true>` TwiML when
no agent answers. Send-voicemail is an outbound `<Pause><Say|Play>
<Hangup>` with `MachineDetection=Enable`.

## Contacts

| | |
|---|---|
| Web routes | `/contacts`, `/contacts/new`, `/contacts/{id}/edit`, `/contacts/import` |
| API routes | `/api/contacts`, `/api/contacts/suggest`, `/api/contacts/quick-save`, `/api/contacts/{id}` (CRUD), `/api/contacts/import\|export.csv`, `/api/contact-tags/*` |
| Permissions | `manage-contacts` (CRUD), `make-calls` (typeahead + quick-save are open) |
| Models | `Contact`, `ContactTag` |
| Services | `PhoneNormalizer` (libphonenumber-php) |

T9 search converts letters to digits in PHP for the dialer typeahead.
Quick-save is the lightweight "save unsaved peer" action used by
History / Voicemail / Messages rows via the shared `RowActions`
component.

## Mail

| | |
|---|---|
| Web routes | `/mail`, `/mail/compose`, `/mail/{thread}`, `/mail/templates`, `/mail/campaigns`, `/mail/campaigns/new`, `/mail/campaigns/{id}`, `/mail/stats`, `/mail/suppressions` |
| API routes | `/api/mail/*` |
| Webhooks | `/webhooks/sendgrid/events`, `/webhooks/sendgrid/inbound` |
| Permissions | `view-mail`, `send-mail`, `manage-mail-templates`, `send-bulk-mail`, `view-mail-stats`, `manage-mail-suppressions` |
| Models | `Mail`, `MailThread`, `MailAttachment`, `MailTemplate`, `MailCampaign`, `MailCampaignRecipient`, `MailSuppression`, `MailEvent`, `MailConfig` |
| Services | `SendGridService`, `InboundParser` |
| Jobs | `DispatchBulkMailBatch` |

Outbound supports up to 10 attachments per send, 25 MB per file, 28 MB
combined (under SendGrid's 30 MB hard cap). Inbound Parse threads via
`In-Reply-To` headers + normalized subjects. Event Webhook events flip
each Mail row's status (delivered / opened / clicked / bounced) and
auto-populate `MailSuppression`.

## Fax (fax.plus)

| | |
|---|---|
| Web routes | `/fax`, `/fax/send`, `/fax/{id}` |
| API routes | `/api/faxes`, `/api/faxes/{id}/pdf`, `/api/faxplus/config` |
| Webhooks | `/webhooks/faxplus/status`, `/webhooks/faxplus/inbound` |
| Permissions | `view-fax`, `send-fax` |
| Models | `Fax`, `FaxDocument`, `FaxConfig` |
| Services | `FaxPlusService`, `VerifyFaxPlusSignature` middleware |
| Commands | `php artisan faxplus:sync-webhooks` |

PDF cap: 30 MB / 200 pages per fax. Signed-webhook ingestion via
HMAC-SHA256 of the raw body. Inbound PDFs cached locally on first
download for instant preview.

## Lookup

| | |
|---|---|
| Web routes | `/lookup`, `/lookup/{id}` |
| API routes | `/api/lookups`, `/api/lookups/pre-dial`, `/api/lookups/{id}` |
| Permissions | `use-lookup` |
| Models | `Lookup` (one row per attempt, full audit trail) |
| Services | `LookupService`, `RunLookupJob` |
| Settings | `auto_lookup_inbound`, `auto_lookup_outbound`, `lookup_cache_days` on `call_settings` |

Sources: `manual_search` / `incoming_manual` / `incoming_auto` /
`outgoing_manual` / `outgoing_auto`. Auto-triggers never fire for
existing contacts. Result auto-upserts a Contact tagged `lookup` with
the caller name. Real-time `LookupCompleted` event populates the
`IncomingCallSheet` with the resolved name.

## Conversations: Chat / RCS / WhatsApp / Messenger

Four UI surfaces on one shared backend (`Twilio Conversations`).

| | |
|---|---|
| Web routes | `/chat`, `/rcs`, `/whatsapp`, `/facebook` (each + `/new` + `/{id}`) |
| API routes | `/api/conversations` (channel filter), `/api/conversations/{id}`, `/api/conversations/{id}/messages`, `/api/conversations-config` |
| Webhooks | `/webhooks/twilio/conversations` (one endpoint, all channels) |
| Permissions | `use-chat`, `use-rcs`, `use-whatsapp`, `use-facebook` |
| Models | `Conversation`, `ConversationParticipant`, `ConversationMessage`, `ConversationMedia`, `ConversationsConfig` |
| Services | `ConversationsService` |
| Frontend | shared `ChannelApp`, `ChannelThread`, `ChannelNew` components |

`@twilio/conversations` JS SDK (browser-side) handles typing indicators
and read receipts. Server publishes `ConversationMessageReceived`
events for unread badge updates.

## Video

| | |
|---|---|
| Web routes | `/video`, `/video/{id}`, `/video/recordings` |
| API routes | `/api/video/rooms`, `/api/video/rooms/{id}/token\|end\|compose\|kick`, `/api/video/recordings` |
| Webhooks | `/webhooks/twilio/video/status` |
| Permissions | `use-video`, `manage-video-rooms`, `view-video-recordings` |
| Models | `VideoRoom`, `VideoRoomParticipant`, `VideoRecording` |
| Services | `VideoService` |
| Frontend | uses `twilio-video` JS SDK |

Group rooms cap at 50 participants; group-small at 4; P2P at 2.
Recording is opt-in per room (~$0.0015/min/track) with composition
($0.01/min) for downloadable MP4.

## Billing

| | |
|---|---|
| Web routes | `/billing` |
| API routes | `/api/billing/summary`, `/api/billing/refresh` |
| Permissions | `view-billing` |
| Models | `BillingSnapshot` |
| Services | `BillingService` |
| Commands | `php artisan billing:snapshot` (scheduled every 6h) |

Calls Twilio `Balance.fetch` + `Usage.records.read`. Cached snapshot
served by default; "Refresh" button forces a live fetch.

## Diagnostics

| | |
|---|---|
| Web routes | `/diagnostics` |
| Permissions | none (any authed user) |

Pure browser-side: Web Audio AnalyserNode for live mic level meter,
`<video>` srcObject preview for camera, `OscillatorNode` 440 Hz tone
for speaker, `mediaDevices.enumerateDevices` for the device list.
`setSinkId()` (where supported) for output device picker.

## Analytics

| | |
|---|---|
| Web routes | `/settings/analytics` |
| API routes | `/api/analytics/summary` |
| Permissions | `view-analytics` |
| Services | `MetricsAggregator` |

Tabs: Voice / SMS / Mail / Fax / Lookup / Conversations / Video. Each
queries the appropriate model with a configurable window (7 / 14 / 30 /
60 / 90 days).

## IVR builder

| | |
|---|---|
| Web routes | `/settings/ivr`, `/settings/ivr/{id}` |
| API routes | `/api/ivr-flows/*` |
| Webhooks | `/webhooks/twilio/ivr/{flow}/{node}/{action}` |
| Permissions | `manage-ivr` |
| Models | `IvrFlow`, `IvrNode` |
| Services | `IvrExecutionService` |
| Frontend | `@xyflow/react` (React Flow v12) |

Drag-drop canvas with node types: say / play / gather / dial / record /
voicemail / hangup / goto / condition / queue / transfer.

## Routing engine

| | |
|---|---|
| Web routes | `/settings/routing`, `/settings/routing/{id}` |
| API routes | `/api/routing-rules/*` |
| Permissions | `manage-routing` |
| Models | `RoutingRule`, `RoutingQueue`, `AgentSkill` |
| Services | `AgentRoutingService` |

Rules consulted in priority order before the default `<Dial><Client>`
in `CallRoutingService::route()`. Action types: `ring_user`,
`simultaneous_ring`, `priority_list`, `round_robin`, `skill_based`,
`forward`, `voicemail`, `ivr`, `queue`.

## Team + permissions

| | |
|---|---|
| Web routes | `/settings/team` |
| API routes | `/api/team/*` |
| Permissions | `manage-team` |
| Models | `User`, `Invitation` (+ Spatie permission tables) |

Per-row permission editor (modal) on the team page. Role-derived perms
locked / greyed; direct grants toggleable. Audit-logged.

## Audit log

| | |
|---|---|
| Web routes | `/settings/audit-log` |
| API routes | `/api/settings/audit-log` |
| Permissions | `manage-team` |
| Models | `AuditLog` |
| Services | `AuditLogger` |

Append-only. Captures `view-as-admin.*` (cross-user data access),
`team.role.set`, `team.permissions.set`, `debug.flag.set`,
`debug.log.cleared`.

## Per-module debug log

| | |
|---|---|
| Web routes | `/settings/debug` |
| API routes | `/api/debug/flags`, `/api/debug/log` |
| Permissions | `manage-twilio` |
| Models | `ModuleDebugFlag` |
| Services | `DebugLogger` |

Toggle-able modules: voice / messaging / lookup / billing /
conversations / video / fax / mail / webhooks. Logs to
`storage/logs/module-debug-YYYY-MM-DD.log` (daily rotation, 7-day
retention). Tokens / signing keys / JWTs auto-redacted.

## Cross-cutting: admin sees-all

The `App\Models\Concerns\ScopedToUser` trait + `ownedBy(?User $user)`
scope is applied to:

- `Call`, `Message`, `Voicemail`, `Contact`, `ContactTag`
- `Fax`, `Mail` (via direct `user_id`), `Conversation` (via
  `owner_user_id`), `VideoRoom` (via `created_by_user_id` + participant
  membership)

Admin queries bypass the scope; all other users see only their own
rows. Settings models (call settings, blocklist, IVR, routing,
templates, campaigns) intentionally **don't** use the trait — admins
shouldn't override another user's preferences.

Admin reads of non-owned rows write `view-as-admin.{model}.{action}`
audit entries.
