<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\TwilioConfig;
use App\Services\Twilio\NumberProvisioner;
use App\Services\Twilio\TwilioClientFactory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Twilio\Exceptions\RestException;

class TwilioConfigController extends Controller
{
    public function __construct(
        private TwilioClientFactory $factory,
        private NumberProvisioner $provisioner,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $config = TwilioConfig::active();

        return response()->json([
            'configured' => (bool) $config,
            'accountSid' => $config?->account_sid_enc ? maskMiddle($config->account_sid_enc) : null,
            'phoneNumber' => $config?->phone_number,
            'twimlAppSid' => $config?->twiml_app_sid,
            'verifiedAt' => $config?->verified_at,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'account_sid' => ['required', 'string', 'starts_with:AC', 'size:34'],
            'auth_token' => ['required', 'string', 'min:32'],
        ]);

        $client = $this->factory->fromCredentials($validated['account_sid'], $validated['auth_token']);

        try {
            $account = $client->api->v2010->accounts($validated['account_sid'])->fetch();
        } catch (RestException $e) {
            return response()->json([
                'message' => 'Twilio rejected those credentials.',
                'error' => $e->getMessage(),
            ], 422);
        }

        $config = TwilioConfig::active() ?? new TwilioConfig();
        $config->fill([
            'user_id' => $request->user()->id,
            'account_sid_enc' => $validated['account_sid'],
            'auth_token_enc' => $validated['auth_token'],
            'is_active' => true,
            'verified_at' => now(),
        ])->save();

        return response()->json([
            'message' => 'Twilio account connected.',
            'account' => [
                'sid' => $account->sid,
                'friendlyName' => $account->friendlyName,
                'status' => $account->status,
            ],
        ]);
    }

    public function disconnect(Request $request): JsonResponse
    {
        $config = TwilioConfig::active();
        if (!$config) {
            return response()->json(['message' => 'Nothing to disconnect.']);
        }
        $config->update(['is_active' => false, 'verified_at' => null]);
        return response()->json(['message' => 'Twilio disconnected.']);
    }
}

if (! function_exists('maskMiddle')) {
    function maskMiddle(?string $value, int $start = 4, int $end = 4): ?string
    {
        if ($value === null || $value === '') return null;
        $len = strlen($value);
        if ($len <= $start + $end) return str_repeat('•', $len);
        return substr($value, 0, $start) . str_repeat('•', $len - $start - $end) . substr($value, -$end);
    }
}
