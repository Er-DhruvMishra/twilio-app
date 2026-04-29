<?php

namespace App\Http\Middleware;

use App\Models\BillingSnapshot;
use App\Models\Call;
use App\Models\Conversation;
use App\Models\Fax;
use App\Models\Mail;
use App\Models\Message;
use App\Models\TwilioConfig;
use App\Models\Voicemail;
use App\Support\WebhookUrl;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'presence' => $user->presence,
                    'roles' => $user->getRoleNames(),
                    'permissions' => $user->getAllPermissions()->pluck('name'),
                ] : null,
            ],
            'badges' => fn () => $user ? [
                'missedCalls' => Call::where('user_id', $user->id)
                    ->where('disposition', 'missed')
                    ->where('started_at', '>=', now()->subDays(30))
                    ->whereDoesntHave('voicemail')
                    ->count(),
                'unreadMessages' => Message::where('user_id', $user->id)
                    ->where('direction', 'inbound')
                    ->where('is_read', false)
                    ->count(),
                'unreadVoicemails' => Voicemail::where('user_id', $user->id)
                    ->where('is_read', false)
                    ->count(),
                'unreadFaxes' => Fax::where('user_id', $user->id)
                    ->where('direction', 'inbound')
                    ->where('is_read', false)
                    ->count(),
                'unreadMail' => Mail::where('user_id', $user->id)
                    ->where('direction', 'inbound')
                    ->where('is_read', false)
                    ->count(),
                'unreadChat' => Conversation::where('owner_user_id', $user->id)
                    ->where('channel', 'chat')
                    ->sum('unread_count_for_owner'),
                'unreadRcs' => Conversation::where('owner_user_id', $user->id)
                    ->where('channel', 'rcs')
                    ->sum('unread_count_for_owner'),
                'unreadWhatsapp' => Conversation::where('owner_user_id', $user->id)
                    ->where('channel', 'whatsapp')
                    ->sum('unread_count_for_owner'),
                'unreadFacebook' => Conversation::where('owner_user_id', $user->id)
                    ->where('channel', 'facebook')
                    ->sum('unread_count_for_owner'),
                'lowBalance' => $this->isLowBalance(),
            ] : null,
            'twilio' => fn () => $this->twilioStatus(),
            'reverb' => [
                'key' => env('REVERB_APP_KEY'),
                'host' => env('REVERB_HOST', 'localhost'),
                'port' => (int) env('REVERB_PORT', 8080),
                'scheme' => env('REVERB_SCHEME', 'http'),
            ],
            'vapid' => [
                'publicKey' => env('VAPID_PUBLIC_KEY'),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ];
    }

    private function isLowBalance(): bool
    {
        $snap = BillingSnapshot::orderByDesc('fetched_at')->first();
        return $snap ? ((int) $snap->balance_cents) < 1000 : false;
    }

    private function twilioStatus(): array
    {
        $config = TwilioConfig::active();
        return [
            'configured' => (bool) $config,
            'phoneNumber' => $config?->phone_number,
            'numberProvisioned' => (bool) $config?->phone_number_sid,
            'twimlAppReady' => (bool) $config?->twiml_app_sid,
            'webhookBaseUrl' => WebhookUrl::base(),
            'webhookPublic' => WebhookUrl::isPublic(),
        ];
    }
}
