<?php

use App\Http\Controllers\Api\AgentPresenceController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\CallController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\FaxController;
use App\Http\Controllers\Api\LookupController;
use App\Http\Controllers\Api\MailCampaignController;
use App\Http\Controllers\Api\MailController;
use App\Http\Controllers\Api\MailTemplateController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\VideoController;
use App\Http\Controllers\Api\TwilioTokenController;
use App\Http\Controllers\Api\VoicemailController;
use App\Http\Controllers\Settings\AutoReplyRuleController;
use App\Http\Controllers\Settings\BlockedNumberController;
use App\Http\Controllers\Settings\BulkSmsController;
use App\Http\Controllers\Settings\CallSettingsController;
use App\Http\Controllers\Settings\ConversationsConfigController;
use App\Http\Controllers\Settings\DebugController;
use App\Http\Controllers\Settings\FaxConfigController;
use App\Http\Controllers\Settings\MailConfigController;
use App\Http\Controllers\Settings\IvrFlowController;
use App\Http\Controllers\Settings\NumberPickerController;
use App\Http\Controllers\Settings\RoutingRuleController;
use App\Http\Controllers\Settings\SmsTemplateController;
use App\Http\Controllers\Settings\TeamController;
use App\Http\Controllers\Settings\TwilioConfigController;
use Illuminate\Support\Facades\Route;

// Laravel 11 auto-prefixes this file with /api. Use `web` middleware so we get
// session cookie auth (Sanctum SPA-style) instead of stateless API tokens.
Route::middleware(['web', 'auth'])->group(function () {
    Route::post('/twilio/token', [TwilioTokenController::class, 'issue']);
    Route::get('/twilio/health', [\App\Http\Controllers\Api\TwilioHealthController::class, 'index']);

    // Agent presence
    Route::post('/agents/presence', [AgentPresenceController::class, 'update']);
    Route::post('/agents/heartbeat', [AgentPresenceController::class, 'heartbeat']);
    Route::put('/agents/skills', [AgentPresenceController::class, 'setSkills']);

    // Analytics
    Route::middleware('can:view-analytics')->group(function () {
        Route::get('/analytics/summary', [AnalyticsController::class, 'summary']);
    });

    // Web Push
    Route::get('/push/vapid-public-key', [PushSubscriptionController::class, 'vapid']);
    Route::post('/push/subscribe', [PushSubscriptionController::class, 'subscribe']);
    Route::delete('/push/subscribe', [PushSubscriptionController::class, 'unsubscribe']);
    Route::post('/push/test', [PushSubscriptionController::class, 'test']);

    // Calls
    Route::get('/calls', [CallController::class, 'index']);
    Route::get('/calls/last-outbound', [CallController::class, 'lastOutbound']);
    Route::post('/calls/sync', [CallController::class, 'syncFromTwilio']);
    Route::post('/calls/{id}/reject', [CallController::class, 'reject']);
    Route::post('/calls/{id}/tag', [CallController::class, 'tag']);
    Route::post('/calls/{sid}/recording/start', [CallController::class, 'startRecording'])->where('sid', '[A-Za-z0-9]+');
    Route::post('/calls/{sid}/recording/stop', [CallController::class, 'stopRecording'])->where('sid', '[A-Za-z0-9]+');
    Route::get('/recordings/{id}/audio', [CallController::class, 'recording'])->name('api.recordings.audio');

    // Voicemail
    Route::get('/voicemails', [VoicemailController::class, 'index']);
    Route::post('/voicemails/send', [VoicemailController::class, 'send']);
    Route::post('/voicemails/{id}/read', [VoicemailController::class, 'markRead'])->whereNumber('id');
    Route::delete('/voicemails/{id}', [VoicemailController::class, 'destroy'])->whereNumber('id');

    // Messages
    Route::middleware('can:send-sms')->group(function () {
        Route::get('/messages/threads', [MessageController::class, 'threads']);
        Route::get('/messages/search', [MessageController::class, 'search']);
        Route::post('/messages', [MessageController::class, 'send']);
        Route::get('/messages/{thread}', [MessageController::class, 'thread'])->where('thread', '.+');
    });

    // Contact typeahead + quick-save are used by the Dialer + SMS Compose +
    // Save-from-history. They're read-only / append-only and already scoped
    // to the requester's own contacts, so any authed user gets them.
    Route::get('/contacts/suggest', [ContactController::class, 'suggest']);
    Route::post('/contacts/quick-save', [ContactController::class, 'quickSave']);

    // Contacts
    Route::middleware('can:manage-contacts')->group(function () {
        Route::get('/contacts', [ContactController::class, 'index']);
        Route::post('/contacts', [ContactController::class, 'store']);
        Route::get('/contacts/export.csv', [ContactController::class, 'exportCsv']);
        Route::post('/contacts/import', [ContactController::class, 'importCsv']);
        Route::get('/contacts/{id}', [ContactController::class, 'show'])->whereNumber('id');
        Route::put('/contacts/{id}', [ContactController::class, 'update'])->whereNumber('id');
        Route::delete('/contacts/{id}', [ContactController::class, 'destroy'])->whereNumber('id');

        Route::get('/contact-tags', [ContactController::class, 'tagsIndex']);
        Route::post('/contact-tags', [ContactController::class, 'tagsStore']);
        Route::delete('/contact-tags/{id}', [ContactController::class, 'tagsDestroy'])->whereNumber('id');
    });

    // Billing (Twilio Usage + Balance, read-only)
    Route::middleware('can:view-billing')->group(function () {
        Route::get('/billing/summary', [BillingController::class, 'summary']);
        Route::post('/billing/refresh', [BillingController::class, 'refresh']);
    });

    // Fax (fax.plus)
    Route::middleware('can:view-fax')->group(function () {
        Route::get('/faxes', [FaxController::class, 'index']);
        Route::get('/faxes/{id}', [FaxController::class, 'show'])->whereNumber('id');
        Route::get('/faxes/{id}/pdf', [FaxController::class, 'pdf'])->whereNumber('id')->name('api.faxes.pdf');
        Route::delete('/faxes/{id}', [FaxController::class, 'destroy'])->whereNumber('id');
    });
    Route::middleware('can:send-fax')->group(function () {
        Route::post('/faxes', [FaxController::class, 'send']);
    });
    Route::middleware('can:manage-twilio')->group(function () {
        Route::get('/faxplus/config', [FaxConfigController::class, 'show']);
        Route::post('/faxplus/config', [FaxConfigController::class, 'store']);
    });

    // Mail (SendGrid)
    Route::middleware('can:view-mail')->group(function () {
        Route::get('/mail/threads', [MailController::class, 'threads']);
        Route::get('/mail/threads/{id}', [MailController::class, 'thread'])->whereNumber('id');
        Route::get('/mail/attachments/{id}', [MailController::class, 'attachment'])->whereNumber('id');
    });
    Route::middleware('can:send-mail')->group(function () {
        Route::post('/mail', [MailController::class, 'send']);
    });
    Route::middleware('can:view-mail-stats')->group(function () {
        Route::get('/mail/stats', [MailController::class, 'stats']);
    });
    Route::middleware('can:manage-mail-suppressions')->group(function () {
        Route::get('/mail/suppressions', [MailController::class, 'suppressions']);
        Route::delete('/mail/suppressions/{email}', [MailController::class, 'removeSuppression']);
    });
    Route::middleware('can:manage-mail-templates')->group(function () {
        Route::get('/mail/templates', [MailTemplateController::class, 'index']);
        Route::post('/mail/templates', [MailTemplateController::class, 'store']);
        Route::put('/mail/templates/{id}', [MailTemplateController::class, 'update'])->whereNumber('id');
        Route::delete('/mail/templates/{id}', [MailTemplateController::class, 'destroy'])->whereNumber('id');
        Route::post('/mail/templates/sync', [MailTemplateController::class, 'syncFromSendGrid']);
    });
    Route::middleware('can:send-bulk-mail')->group(function () {
        Route::get('/mail/campaigns', [MailCampaignController::class, 'index']);
        Route::post('/mail/campaigns', [MailCampaignController::class, 'store']);
        Route::get('/mail/campaigns/{id}', [MailCampaignController::class, 'show'])->whereNumber('id');
        Route::post('/mail/campaigns/{id}/start', [MailCampaignController::class, 'start'])->whereNumber('id');
        Route::post('/mail/campaigns/{id}/cancel', [MailCampaignController::class, 'cancel'])->whereNumber('id');
    });
    Route::middleware('can:manage-twilio')->group(function () {
        Route::get('/sendgrid/config', [MailConfigController::class, 'show']);
        Route::post('/sendgrid/config', [MailConfigController::class, 'store']);
    });

    // Conversations (shared backend; controller checks any of use-chat /
    // use-rcs / use-whatsapp / use-facebook based on the requested channel).
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::get('/conversations/{id}', [ConversationController::class, 'show'])->whereNumber('id');
    Route::post('/conversations', [ConversationController::class, 'store']);
    Route::post('/conversations/{id}/messages', [ConversationController::class, 'send'])->whereNumber('id');
    Route::delete('/conversations/{id}', [ConversationController::class, 'destroy'])->whereNumber('id');
    Route::middleware('can:manage-twilio')->group(function () {
        Route::get('/conversations-config', [ConversationsConfigController::class, 'show']);
        Route::post('/conversations-config', [ConversationsConfigController::class, 'store']);
    });

    // Video Chat (Twilio Video)
    Route::middleware('can:use-video')->group(function () {
        Route::get('/video/rooms', [VideoController::class, 'index']);
        Route::get('/video/rooms/{id}', [VideoController::class, 'show'])->whereNumber('id');
        Route::post('/video/rooms', [VideoController::class, 'store']);
        Route::post('/video/rooms/{id}/token', [VideoController::class, 'token'])->whereNumber('id');
        Route::post('/video/rooms/{id}/end', [VideoController::class, 'end'])->whereNumber('id');
        Route::post('/video/rooms/{id}/compose', [VideoController::class, 'compose'])->whereNumber('id');
        Route::post('/video/rooms/{id}/kick/{participant}', [VideoController::class, 'kick'])->whereNumber('id');
        Route::get('/video/recordings', [VideoController::class, 'recordings']);
    });

    // Lookup (Twilio Lookup v2)
    Route::middleware('can:use-lookup')->group(function () {
        Route::get('/lookups', [LookupController::class, 'index']);
        Route::post('/lookups', [LookupController::class, 'store']);
        Route::post('/lookups/pre-dial', [LookupController::class, 'preDial']);
        Route::get('/lookups/{id}', [LookupController::class, 'show'])->whereNumber('id');
    });

    // Per-user call settings + blocklist
    Route::get('/settings/call', [CallSettingsController::class, 'show']);
    Route::put('/settings/call', [CallSettingsController::class, 'update']);
    Route::get('/settings/blocklist', [BlockedNumberController::class, 'index']);
    Route::post('/settings/blocklist', [BlockedNumberController::class, 'store']);
    Route::delete('/settings/blocklist/{id}', [BlockedNumberController::class, 'destroy'])->whereNumber('id');

    // Auto-reply rules
    Route::get('/auto-reply-rules', [AutoReplyRuleController::class, 'index']);
    Route::post('/auto-reply-rules', [AutoReplyRuleController::class, 'store']);
    Route::put('/auto-reply-rules/{id}', [AutoReplyRuleController::class, 'update'])->whereNumber('id');
    Route::delete('/auto-reply-rules/{id}', [AutoReplyRuleController::class, 'destroy'])->whereNumber('id');

    // SMS templates
    Route::get('/sms-templates', [SmsTemplateController::class, 'index']);
    Route::post('/sms-templates', [SmsTemplateController::class, 'store']);
    Route::put('/sms-templates/{id}', [SmsTemplateController::class, 'update'])->whereNumber('id');
    Route::delete('/sms-templates/{id}', [SmsTemplateController::class, 'destroy'])->whereNumber('id');

    // Bulk SMS campaigns
    Route::middleware('can:send-bulk-sms')->group(function () {
        Route::get('/bulk-sms', [BulkSmsController::class, 'index']);
        Route::post('/bulk-sms', [BulkSmsController::class, 'store']);
        Route::get('/bulk-sms/{id}', [BulkSmsController::class, 'show'])->whereNumber('id');
        Route::post('/bulk-sms/{id}/cancel', [BulkSmsController::class, 'cancel'])->whereNumber('id');
    });

    // IVR flows
    Route::middleware('can:manage-ivr')->group(function () {
        Route::get('/ivr-flows', [IvrFlowController::class, 'index']);
        Route::post('/ivr-flows', [IvrFlowController::class, 'store']);
        Route::get('/ivr-flows/{id}', [IvrFlowController::class, 'show'])->whereNumber('id');
        Route::put('/ivr-flows/{id}', [IvrFlowController::class, 'update'])->whereNumber('id');
        Route::post('/ivr-flows/{id}/graph', [IvrFlowController::class, 'saveGraph'])->whereNumber('id');
        Route::delete('/ivr-flows/{id}', [IvrFlowController::class, 'destroy'])->whereNumber('id');
    });

    // Routing rules
    Route::middleware('can:manage-routing')->group(function () {
        Route::get('/routing-rules', [RoutingRuleController::class, 'index']);
        Route::post('/routing-rules', [RoutingRuleController::class, 'store']);
        Route::get('/routing-rules/{id}', [RoutingRuleController::class, 'show'])->whereNumber('id');
        Route::put('/routing-rules/{id}', [RoutingRuleController::class, 'update'])->whereNumber('id');
        Route::delete('/routing-rules/{id}', [RoutingRuleController::class, 'destroy'])->whereNumber('id');
    });

    // Team management (admin)
    Route::middleware('can:manage-team')->group(function () {
        Route::get('/team', [TeamController::class, 'index']);
        Route::post('/team/invites', [TeamController::class, 'invite']);
        Route::delete('/team/invites/{id}', [TeamController::class, 'revokeInvite'])->whereNumber('id');
        Route::put('/team/{user}/role', [TeamController::class, 'setRole'])->whereNumber('user');
        Route::put('/team/{user}/permissions', [TeamController::class, 'setPermissions'])->whereNumber('user');
        Route::delete('/team/{user}', [TeamController::class, 'destroy'])->whereNumber('user');
    });

    // Debug toggles + log viewer (admin-only)
    Route::middleware('can:manage-twilio')->group(function () {
        Route::get('/debug/flags', [DebugController::class, 'index']);
        Route::put('/debug/flags', [DebugController::class, 'update']);
        Route::get('/debug/log', [DebugController::class, 'tail']);
        Route::delete('/debug/log', [DebugController::class, 'clear']);
    });

    // Audit log viewer (gated on manage-team since it includes role/perm changes)
    Route::middleware('can:manage-team')->group(function () {
        Route::get('/settings/audit-log', [\App\Http\Controllers\Settings\AuditLogController::class, 'index']);
    });

    Route::middleware('can:manage-twilio')->group(function () {
        Route::get('/twilio/config', [TwilioConfigController::class, 'show']);
        Route::post('/twilio/config', [TwilioConfigController::class, 'store']);
        Route::delete('/twilio/config', [TwilioConfigController::class, 'disconnect']);

        Route::get('/numbers/owned', [NumberPickerController::class, 'owned']);
        Route::get('/numbers/search', [NumberPickerController::class, 'search']);
        Route::post('/numbers/buy', [NumberPickerController::class, 'buy']);
        Route::post('/numbers/use', [NumberPickerController::class, 'use']);
        Route::post('/twilio/sync-webhooks', [NumberPickerController::class, 'syncWebhooks']);
    });
});
