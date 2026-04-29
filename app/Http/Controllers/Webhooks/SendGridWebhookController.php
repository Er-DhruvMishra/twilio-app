<?php

namespace App\Http\Controllers\Webhooks;

use App\Events\MailReceived;
use App\Events\MailStatusUpdated;
use App\Http\Controllers\Controller;
use App\Models\Mail;
use App\Models\MailEvent;
use App\Models\MailSuppression;
use App\Notifications\IncomingMailNotification;
use App\Services\Debug\DebugLogger;
use App\Services\Mail\InboundParser;
use Illuminate\Http\Request;

class SendGridWebhookController extends Controller
{
    public function __construct(private InboundParser $inboundParser) {}

    /**
     * Event Webhook: SendGrid POSTs an array of events for delivery,
     * opens, clicks, bounces, etc. Idempotent on (sg_message_id, event).
     */
    public function events(Request $request)
    {
        $events = $request->json()->all();
        DebugLogger::log('webhooks', 'POST /webhooks/sendgrid/events', ['count' => is_array($events) ? count($events) : 0, 'events' => $events]);
        DebugLogger::log('mail', 'inbound webhook · events', ['count' => is_array($events) ? count($events) : 0]);
        if (!is_array($events)) return response('ok');

        foreach ($events as $e) {
            $sgId = (string) ($e['sg_message_id'] ?? '');
            $event = (string) ($e['event'] ?? '');
            $email = (string) ($e['email'] ?? '');
            if (!$event) continue;

            MailEvent::create([
                'sg_message_id' => $sgId,
                'email' => $email,
                'event' => $event,
                'event_timestamp' => isset($e['timestamp']) ? \Carbon\Carbon::createFromTimestamp((int) $e['timestamp']) : now(),
                'payload' => $e,
            ]);

            $mail = $sgId ? Mail::where('sg_message_id', $sgId)->first() : null;
            if ($mail) {
                $patch = [];
                switch ($event) {
                    case 'delivered': $patch['status'] = 'delivered'; break;
                    case 'open': $patch['status'] = 'opened'; $patch['opened_at'] = now(); break;
                    case 'click': $patch['status'] = 'clicked'; $patch['clicked_at'] = now(); break;
                    case 'bounce': $patch['status'] = 'bounced'; $patch['bounced_at'] = now(); $patch['error_message'] = $e['reason'] ?? null; break;
                    case 'dropped': $patch['status'] = 'dropped'; $patch['error_message'] = $e['reason'] ?? null; break;
                    case 'spamreport': $patch['status'] = 'spam'; break;
                    case 'blocked': $patch['status'] = 'blocked'; break;
                }
                if ($patch) {
                    $mail->update($patch);
                    MailStatusUpdated::dispatch($mail->fresh());
                }
            }

            // Mirror suppressions so the Suppressions UI doesn't have to
            // query SendGrid every time.
            if (in_array($event, ['bounce', 'dropped', 'spamreport', 'unsubscribe', 'group_unsubscribe', 'blocked'], true) && $email) {
                $type = match ($event) {
                    'bounce' => 'bounce',
                    'dropped' => 'invalid',
                    'spamreport' => 'spam',
                    'unsubscribe', 'group_unsubscribe' => 'unsubscribe',
                    'blocked' => 'block',
                    default => 'bounce',
                };
                MailSuppression::updateOrCreate(
                    ['email' => $email, 'type' => $type],
                    ['reason' => $e['reason'] ?? null, 'suppressed_at' => now()],
                );
            }
        }

        return response('ok');
    }

    /** Inbound Parse: SendGrid POSTs a multipart form. */
    public function inbound(Request $request)
    {
        DebugLogger::log('webhooks', 'POST /webhooks/sendgrid/inbound', $request->except(['attachment-info', 'envelope']) + [
            'attachment_count' => (int) $request->input('attachments', 0),
            'has_html' => (bool) $request->input('html'),
            'has_text' => (bool) $request->input('text'),
        ]);
        DebugLogger::log('mail', 'inbound webhook · parse', [
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'subject' => $request->input('subject'),
        ]);
        try {
            $mail = $this->inboundParser->parse($request);
            if ($mail) {
                MailReceived::dispatch($mail);
                $owner = $mail->user;
                if ($owner) {
                    dispatch(function () use ($owner, $mail) {
                        $owner->notify(new IncomingMailNotification($mail));
                    })->afterResponse();
                }
            }
        } catch (\Throwable $e) {
            DebugLogger::trace('mail', 'inbound parse failed', [], null, $e);
            // Don't return 5xx — SendGrid will retry; we'd rather drop a malformed event.
        }
        return response('ok');
    }
}
