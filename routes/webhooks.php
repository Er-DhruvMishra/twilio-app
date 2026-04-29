<?php

use App\Http\Controllers\Webhooks\ConversationsWebhookController;
use App\Http\Controllers\Webhooks\FaxPlusWebhookController;
use App\Http\Controllers\Webhooks\IvrWebhookController;
use App\Http\Controllers\Webhooks\RecordingWebhookController;
use App\Http\Controllers\Webhooks\SendGridWebhookController;
use App\Http\Controllers\Webhooks\SmsWebhookController;
use App\Http\Controllers\Webhooks\VideoWebhookController;
use App\Http\Controllers\Webhooks\VoiceWebhookController;
use App\Http\Controllers\Webhooks\VoicemailWebhookController;
use Illuminate\Support\Facades\Route;

// Twilio webhooks. CSRF excluded in bootstrap/app.php.
// Signature middleware can be bypassed in dev via TWILIO_VALIDATE_SIGNATURE=false.

Route::middleware('twilio.signature')->prefix('webhooks/twilio')->group(function () {
    // Voice
    Route::post('/voice/outgoing', [VoiceWebhookController::class, 'outgoing']);
    Route::post('/voice/incoming', [VoiceWebhookController::class, 'incoming']);
    Route::post('/voice/status', [VoiceWebhookController::class, 'status']);
    Route::post('/voice/dial-status', [VoiceWebhookController::class, 'dialStatus']);
    Route::post('/voice/recording', RecordingWebhookController::class);
    Route::post('/voice/voicemail', VoicemailWebhookController::class);

    // SMS
    Route::post('/sms/incoming', [SmsWebhookController::class, 'incoming']);
    Route::post('/sms/status', [SmsWebhookController::class, 'status']);

    // Conversations (all 4 channels share this endpoint).
    Route::post('/conversations', [ConversationsWebhookController::class, 'handle']);

    // Video status callbacks (room-created, participant events, recording-completed, composition-completed).
    Route::post('/video/status', [VideoWebhookController::class, 'status']);

    // IVR
    Route::post('/ivr/{flow}/entry', [IvrWebhookController::class, 'entry'])->whereNumber('flow');
    Route::post('/ivr/{flow}/{node}/render', [IvrWebhookController::class, 'render'])->whereNumber('flow')->whereNumber('node');
    Route::post('/ivr/{flow}/{node}/{action}', [IvrWebhookController::class, 'handle'])->whereNumber('flow')->whereNumber('node');
});

// fax.plus webhooks (separate signature middleware — different vendor).
Route::middleware('faxplus.signature')->prefix('webhooks/faxplus')->group(function () {
    Route::post('/status', [FaxPlusWebhookController::class, 'status']);
    Route::post('/inbound', [FaxPlusWebhookController::class, 'inbound']);
});

// SendGrid Event Webhook + Inbound Parse.
Route::middleware('sendgrid.signature')->prefix('webhooks/sendgrid')->group(function () {
    Route::post('/events', [SendGridWebhookController::class, 'events']);
    Route::post('/inbound', [SendGridWebhookController::class, 'inbound']);
});
