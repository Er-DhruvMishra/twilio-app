<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\TwilioConfig;
use App\Services\Twilio\NumberProvisioner;
use App\Support\WebhookUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Twilio\Exceptions\RestException;

class NumberPickerController extends Controller
{
    public function __construct(private NumberProvisioner $provisioner) {}

    public function owned(): JsonResponse
    {
        try {
            $numbers = $this->provisioner->listOwned();
        } catch (RestException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        $active = TwilioConfig::active()?->phone_number_sid;

        return response()->json([
            'active_sid' => $active,
            'numbers' => $numbers,
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'country' => ['required', 'string', 'size:2'],
            'area_code' => ['nullable', 'string', 'max:8'],
            'contains' => ['nullable', 'string', 'max:16'],
        ]);

        try {
            $numbers = $this->provisioner->search(
                strtoupper($validated['country']),
                $validated['area_code'] ?? null,
                $validated['contains'] ?? null,
            );
        } catch (RestException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json(['numbers' => $numbers]);
    }

    public function buy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone_number' => ['required', 'string', 'starts_with:+'],
        ]);

        try {
            $bought = $this->provisioner->buy(
                $validated['phone_number'],
                WebhookUrl::for('webhooks/twilio/voice/incoming'),
                WebhookUrl::for('webhooks/twilio/sms/incoming'),
                WebhookUrl::for('webhooks/twilio/voice/status'),
            );
            $this->provisioner->ensureTwiMLApp(WebhookUrl::for('webhooks/twilio/voice/outgoing'));
        } catch (RestException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => "Number {$bought['phoneNumber']} added to your account.",
            'number' => $bought,
        ]);
    }

    public function use(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sid' => ['required', 'string', 'starts_with:PN'],
        ]);

        try {
            $result = $this->provisioner->setActive(
                $validated['sid'],
                WebhookUrl::for('webhooks/twilio/voice/incoming'),
                WebhookUrl::for('webhooks/twilio/sms/incoming'),
                WebhookUrl::for('webhooks/twilio/voice/status'),
            );
            $this->provisioner->ensureTwiMLApp(WebhookUrl::for('webhooks/twilio/voice/outgoing'));
        } catch (RestException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Now using {$result['phoneNumber']}.",
            'number' => $result,
        ]);
    }

    public function syncWebhooks(): JsonResponse
    {
        try {
            $result = $this->provisioner->syncWebhooks(
                WebhookUrl::for('webhooks/twilio/voice/incoming'),
                WebhookUrl::for('webhooks/twilio/sms/incoming'),
                WebhookUrl::for('webhooks/twilio/voice/status'),
            );
            $this->provisioner->ensureTwiMLApp(WebhookUrl::for('webhooks/twilio/voice/outgoing'));
        } catch (\Throwable $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        return response()->json(['message' => 'Webhooks synced.', 'result' => $result]);
    }
}
