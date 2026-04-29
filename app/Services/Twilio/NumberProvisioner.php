<?php

namespace App\Services\Twilio;

use App\Models\TwilioConfig;
use Twilio\Rest\Client;

class NumberProvisioner
{
    public function __construct(private TwilioClientFactory $factory) {}

    public function search(string $country, ?string $areaCode = null, ?string $contains = null, int $limit = 20): array
    {
        $client = $this->client();
        $args = [
            'voiceEnabled' => true,
            'smsEnabled' => true,
            'limit' => $limit,
        ];
        if ($areaCode) $args['areaCode'] = $areaCode;
        if ($contains) $args['contains'] = $contains;

        $numbers = $client->availablePhoneNumbers($country)
            ->local
            ->read($args);

        return array_map(fn ($n) => [
            'phoneNumber' => $n->phoneNumber,
            'friendlyName' => $n->friendlyName,
            'locality' => $n->locality,
            'region' => $n->region,
            'isoCountry' => $n->isoCountry,
            'monthlyCost' => null,
            'capabilities' => self::caps($n->capabilities),
        ], $numbers);
    }

    private static function caps(mixed $caps): array
    {
        if (\is_array($caps)) {
            return [
                'voice' => (bool) ($caps['voice'] ?? $caps['Voice'] ?? false),
                'sms' => (bool) ($caps['sms'] ?? $caps['SMS'] ?? false),
                'mms' => (bool) ($caps['mms'] ?? $caps['MMS'] ?? false),
                'fax' => (bool) ($caps['fax'] ?? $caps['Fax'] ?? false),
            ];
        }
        if (\is_object($caps)) {
            return [
                'voice' => (bool) ($caps->voice ?? false),
                'sms' => (bool) ($caps->sms ?? false),
                'mms' => (bool) ($caps->mms ?? false),
                'fax' => (bool) ($caps->fax ?? false),
            ];
        }
        return ['voice' => false, 'sms' => false, 'mms' => false, 'fax' => false];
    }

    public function buy(string $phoneNumber, string $voiceUrl, string $smsUrl, string $statusCallback): array
    {
        $client = $this->client();
        $config = TwilioConfig::active();

        $created = $client->incomingPhoneNumbers->create([
            'phoneNumber' => $phoneNumber,
            'voiceUrl' => $voiceUrl,
            'voiceMethod' => 'POST',
            'smsUrl' => $smsUrl,
            'smsMethod' => 'POST',
            'statusCallback' => $statusCallback,
            'statusCallbackMethod' => 'POST',
        ]);

        $config->update([
            'phone_number' => $created->phoneNumber,
            'phone_number_sid' => $created->sid,
        ]);

        return [
            'sid' => $created->sid,
            'phoneNumber' => $created->phoneNumber,
            'friendlyName' => $created->friendlyName,
        ];
    }

    public function listOwned(): array
    {
        $client = $this->client();
        $owned = $client->incomingPhoneNumbers->read([], 100);
        return array_map(fn ($n) => [
            'sid' => $n->sid,
            'phoneNumber' => $n->phoneNumber,
            'friendlyName' => $n->friendlyName,
            'voiceUrl' => $n->voiceUrl,
            'smsUrl' => $n->smsUrl,
            'capabilities' => self::caps($n->capabilities),
        ], $owned);
    }

    public function setActive(string $sid, string $voiceUrl, string $smsUrl, string $statusCallback): array
    {
        $client = $this->client();
        $config = TwilioConfig::active();

        $updated = $client->incomingPhoneNumbers($sid)->update([
            'voiceUrl' => $voiceUrl,
            'voiceMethod' => 'POST',
            'smsUrl' => $smsUrl,
            'smsMethod' => 'POST',
            'statusCallback' => $statusCallback,
            'statusCallbackMethod' => 'POST',
        ]);

        $config->update([
            'phone_number' => $updated->phoneNumber,
            'phone_number_sid' => $updated->sid,
        ]);

        return [
            'sid' => $updated->sid,
            'phoneNumber' => $updated->phoneNumber,
            'friendlyName' => $updated->friendlyName,
        ];
    }

    public function syncWebhooks(string $voiceUrl, string $smsUrl, string $statusCallback): array
    {
        $client = $this->client();
        $config = TwilioConfig::active();
        if (!$config?->phone_number_sid) {
            throw new \RuntimeException('No Twilio number provisioned yet');
        }
        $updated = $client->incomingPhoneNumbers($config->phone_number_sid)->update([
            'voiceUrl' => $voiceUrl,
            'voiceMethod' => 'POST',
            'smsUrl' => $smsUrl,
            'smsMethod' => 'POST',
            'statusCallback' => $statusCallback,
            'statusCallbackMethod' => 'POST',
        ]);
        return ['sid' => $updated->sid, 'voiceUrl' => $updated->voiceUrl, 'smsUrl' => $updated->smsUrl];
    }

    public function ensureTwiMLApp(string $voiceUrl): string
    {
        $client = $this->client();
        $config = TwilioConfig::active();

        if ($config->twiml_app_sid) {
            try {
                $client->applications($config->twiml_app_sid)->update([
                    'voiceUrl' => $voiceUrl,
                    'voiceMethod' => 'POST',
                ]);
                return $config->twiml_app_sid;
            } catch (\Throwable) {
                // fall through to create
            }
        }

        $app = $client->applications->create([
            'friendlyName' => 'Virtual Phone OS — Voice',
            'voiceUrl' => $voiceUrl,
            'voiceMethod' => 'POST',
        ]);

        $config->update(['twiml_app_sid' => $app->sid]);
        return $app->sid;
    }

    public function ensureApiKey(string $accountSid, string $authToken, string $friendlyName = 'Virtual Phone OS'): array
    {
        $client = new Client($accountSid, $authToken);
        $key = $client->newKeys->create(['friendlyName' => $friendlyName]);
        return ['sid' => $key->sid, 'secret' => $key->secret];
    }

    public function release(string $sid): void
    {
        $this->client()->incomingPhoneNumbers($sid)->delete();
    }

    private function client(): Client
    {
        $client = $this->factory->active();
        if (!$client) {
            throw new \RuntimeException('Twilio is not configured');
        }
        return $client;
    }
}
