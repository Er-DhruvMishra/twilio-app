<?php

namespace App\Services\Twilio;

use App\Models\TwilioConfig;
use Twilio\Rest\Client;

class TwilioClientFactory
{
    public function fromConfig(TwilioConfig $config): Client
    {
        if ($config->api_key_sid_enc && $config->api_key_secret_enc) {
            return new Client(
                $config->api_key_sid_enc,
                $config->api_key_secret_enc,
                $config->account_sid_enc,
            );
        }

        return new Client($config->account_sid_enc, $config->auth_token_enc);
    }

    public function fromCredentials(string $sid, string $token): Client
    {
        return new Client($sid, $token);
    }

    public function active(): ?Client
    {
        $config = TwilioConfig::active();
        return $config ? $this->fromConfig($config) : null;
    }
}
