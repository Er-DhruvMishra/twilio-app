<?php

namespace App\Services\Twilio;

use App\Models\TwilioConfig;
use App\Models\User;
use App\Services\Debug\DebugLogger;
use Twilio\Jwt\AccessToken;
use Twilio\Jwt\Grants\ChatGrant;
use Twilio\Jwt\Grants\VideoGrant;
use Twilio\Jwt\Grants\VoiceGrant;

class AccessTokenService
{
    public const TTL_SECONDS = 3600;

    public function __construct(private NumberProvisioner $provisioner) {}

    /**
     * Mint a Twilio AccessToken with grants chosen by the user's permissions.
     * Multi-grant tokens are valid — Voice + Chat + Video can ride together,
     * saving the frontend three round-trips.
     *
     * Identity is stable per user (`user_{id}`) so inbound TwiML can `<Dial><Client>user_42</Client></Dial>`.
     *
     * @param array{video_room?: ?string} $opts
     */
    public function issueFor(User $user, array $opts = []): array
    {
        $config = TwilioConfig::active();
        if (!$config) {
            throw new \RuntimeException('Twilio is not configured');
        }
        if (!$config->twiml_app_sid) {
            $voiceUrl = \App\Support\WebhookUrl::for('webhooks/twilio/voice/outgoing');
            $this->provisioner->ensureTwiMLApp($voiceUrl);
            $config->refresh();
        }

        $apiKey = $this->ensureApiKey($config);
        $identity = self::identityFor($user);

        $token = new AccessToken(
            $config->account_sid_enc,
            $apiKey['sid'],
            $apiKey['secret'],
            self::TTL_SECONDS,
            $identity,
        );

        $grants = [];
        // Voice — always granted (foundational), since callers always have at least dial-only permission.
        $voiceGrant = new VoiceGrant();
        $voiceGrant->setOutgoingApplicationSid($config->twiml_app_sid);
        $voiceGrant->setIncomingAllow(true);
        $token->addGrant($voiceGrant);
        $grants[] = 'voice';

        // Chat (Conversations) — for Chat/RCS/WhatsApp/Facebook apps.
        $convServiceSid = env('TWILIO_CONVERSATIONS_SERVICE_SID');
        if ($convServiceSid && $user->getAllPermissions()->pluck('name')->intersect(['use-chat', 'use-rcs', 'use-whatsapp', 'use-facebook'])->isNotEmpty()) {
            $chatGrant = new ChatGrant();
            $chatGrant->setServiceSid($convServiceSid);
            $token->addGrant($chatGrant);
            $grants[] = 'chat';
        }

        // Video — for the Video Chat module.
        if ($user->can('use-video')) {
            $videoGrant = new VideoGrant();
            if (!empty($opts['video_room'])) {
                $videoGrant->setRoom($opts['video_room']);
            }
            $token->addGrant($videoGrant);
            $grants[] = 'video';
        }

        DebugLogger::log('voice', 'access-token.issue', [
            'identity' => $identity,
            'grants' => $grants,
            'ttl' => self::TTL_SECONDS,
            'twiml_app_sid' => $config->twiml_app_sid,
            'video_room' => $opts['video_room'] ?? null,
        ]);

        return [
            'token' => $token->toJWT(),
            'identity' => $identity,
            'expires_in' => self::TTL_SECONDS,
            'grants' => $grants,
        ];
    }

    public static function identityFor(User $user): string
    {
        return 'user_' . $user->id;
    }

    /** Reverse of identityFor — returns the user ID from a Voice client identity, or null. */
    public static function userIdFromIdentity(?string $identity): ?int
    {
        if (!$identity || !str_starts_with($identity, 'user_')) return null;
        $id = (int) substr($identity, 5);
        return $id > 0 ? $id : null;
    }

    /** Lazily provisions an API Key/Secret pair on first use and caches it on TwilioConfig. */
    private function ensureApiKey(TwilioConfig $config): array
    {
        if ($config->api_key_sid_enc && $config->api_key_secret_enc) {
            return ['sid' => $config->api_key_sid_enc, 'secret' => $config->api_key_secret_enc];
        }

        $key = $this->provisioner->ensureApiKey(
            $config->account_sid_enc,
            $config->auth_token_enc,
            'Virtual Phone OS — Voice JS',
        );

        $config->update([
            'api_key_sid_enc' => $key['sid'],
            'api_key_secret_enc' => $key['secret'],
        ]);

        return $key;
    }
}
