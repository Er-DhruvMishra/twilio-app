<?php

namespace App\Services\Twilio;

use App\Events\LookupCompleted;
use App\Models\Contact;
use App\Models\Lookup;
use App\Models\TwilioConfig;
use App\Models\User;
use App\Services\Contacts\PhoneNormalizer;
use App\Services\Debug\DebugLogger;

/**
 * Twilio Lookup v2 wrapper with source-tracked history + 30-day cache +
 * contact auto-upsert. Each call writes one `lookups` row regardless of
 * cache hit (so the audit trail captures who/why/when, not just first-fetch).
 */
class LookupService
{
    /**
     * Source enum values, kept in PHP so callers don't smuggle invalid
     * strings into the DB enum.
     */
    public const SOURCES = [
        'manual_search',
        'incoming_manual',
        'incoming_auto',
        'outgoing_manual',
        'outgoing_auto',
    ];

    public const FIELDS = 'caller_name,line_type_intelligence';

    public function __construct(private TwilioClientFactory $factory) {}

    /**
     * Look up a number. Returns the Lookup row. If a fresh lookup exists
     * within the user's cache window, reuses its data but still writes a
     * new row tagged with the new source so we have full history.
     */
    public function lookup(string $e164, string $source, ?User $user, ?int $cacheDays = null): Lookup
    {
        if (!in_array($source, self::SOURCES, true)) {
            throw new \InvalidArgumentException("Unknown lookup source: {$source}");
        }

        $cacheDays ??= 30;
        $cached = Lookup::where('phone_e164', $e164)
            ->where('looked_up_at', '>=', now()->subDays($cacheDays))
            ->where('is_valid', true)
            ->orderByDesc('looked_up_at')
            ->first();

        if ($cached) {
            $row = Lookup::create([
                'phone_e164' => $e164,
                'caller_name' => $cached->caller_name,
                'caller_type' => $cached->caller_type,
                'line_type' => $cached->line_type,
                'carrier_name' => $cached->carrier_name,
                'country_code' => $cached->country_code,
                'country_name' => $cached->country_name,
                'is_valid' => true,
                'payload' => array_merge($cached->payload ?? [], ['_cache_hit' => true, '_origin_id' => $cached->id]),
                'requested_by_user_id' => $user?->id,
                'source' => $source,
                'cost_cents' => 0,
                'looked_up_at' => now(),
            ]);
            $this->maybeUpsertContact($row, $user);
            LookupCompleted::dispatch($row);
            return $row;
        }

        // Fresh lookup against Twilio.
        $config = TwilioConfig::active();
        if (!$config) {
            return $this->writeInvalid($e164, $source, $user, 'Twilio not configured');
        }

        try {
            $client = $this->factory->fromConfig($config);
            $result = $client->lookups->v2->phoneNumbers($e164)->fetch(['fields' => self::FIELDS]);
            DebugLogger::trace('lookup', 'lookups.v2.fetch', [
                'phone' => $e164,
                'fields' => self::FIELDS,
                'source' => $source,
                'requested_by' => $user?->id,
            ], $result);
        } catch (\Throwable $e) {
            DebugLogger::trace('lookup', 'lookups.v2.fetch', ['phone' => $e164, 'source' => $source], null, $e);
            return $this->writeInvalid($e164, $source, $user, $e->getMessage());
        }

        $callerName = self::extractCallerName($result);
        $callerType = self::extractCallerType($result);
        $lineType = self::extractLineType($result);
        $carrierName = self::extractCarrierName($result);
        $countryCode = property_exists($result, 'countryCode') ? $result->countryCode : null;

        // Best-effort cost tracking — exact pricing depends on the user's
        // Twilio plan and the requested fields.
        $costCents = ($callerName !== null ? 1 : 0) + ($lineType !== null ? 1 : 0);

        $row = Lookup::create([
            'phone_e164' => $e164,
            'caller_name' => $callerName,
            'caller_type' => $callerType,
            'line_type' => $lineType,
            'carrier_name' => $carrierName,
            'country_code' => $countryCode ? strtoupper($countryCode) : null,
            'country_name' => null,
            'is_valid' => (bool) ($result->valid ?? true),
            'payload' => self::normalizePayload($result),
            'requested_by_user_id' => $user?->id,
            'source' => $source,
            'cost_cents' => $costCents,
            'looked_up_at' => now(),
        ]);

        $this->maybeUpsertContact($row, $user);
        LookupCompleted::dispatch($row);
        return $row;
    }

    /**
     * Inbound auto-trigger predicate. Skip if there's a contact match for
     * this user (known number) or if the toggle is off.
     */
    public function shouldAutoLookupInbound(?User $user, string $e164): bool
    {
        if (!$user) return false;
        $settings = \App\Models\CallSetting::firstOrCreate(['user_id' => $user->id]);
        if (!($settings->auto_lookup_inbound ?? false)) return false;
        return !$this->hasContact($user, $e164);
    }

    public function shouldAutoLookupOutbound(?User $user, string $e164): bool
    {
        if (!$user) return false;
        $settings = \App\Models\CallSetting::firstOrCreate(['user_id' => $user->id]);
        if (!($settings->auto_lookup_outbound ?? false)) return false;
        return !$this->hasContact($user, $e164);
    }

    private function hasContact(User $user, string $e164): bool
    {
        return Contact::where('user_id', $user->id)
            ->where('phone_e164', $e164)
            ->exists();
    }

    /**
     * Side-effect: if the lookup got a real caller name AND the requesting
     * user has no contact for this number yet, create a contact tagged
     * 'lookup'. Never overwrite an existing contact.
     */
    private function maybeUpsertContact(Lookup $row, ?User $user): void
    {
        if (!$user || !$row->caller_name || !$row->is_valid) return;

        [$e164, $normalized] = PhoneNormalizer::normalize($row->phone_e164);

        $existing = Contact::where('user_id', $user->id)
            ->where('phone_normalized', $normalized)
            ->first();
        if ($existing) return;

        $contact = Contact::create([
            'user_id' => $user->id,
            'display_name' => $row->caller_name,
            'phone_e164' => $e164,
            'phone_normalized' => $normalized,
            'notes' => self::contactNotes($row),
            'source' => 'lookup',
        ]);

        $tag = \App\Models\ContactTag::firstOrCreate(
            ['user_id' => $user->id, 'name' => 'lookup'],
            ['color' => 'amber'],
        );
        $contact->tags()->syncWithoutDetaching([$tag->id]);
    }

    private static function contactNotes(Lookup $row): string
    {
        $bits = ['Auto-created from caller-id lookup.'];
        if ($row->caller_type) $bits[] = ucfirst($row->caller_type);
        if ($row->line_type) $bits[] = $row->line_type;
        if ($row->carrier_name) $bits[] = $row->carrier_name;
        return implode(' · ', $bits);
    }

    private function writeInvalid(string $e164, string $source, ?User $user, string $reason): Lookup
    {
        return Lookup::create([
            'phone_e164' => $e164,
            'is_valid' => false,
            'payload' => ['error' => $reason],
            'requested_by_user_id' => $user?->id,
            'source' => $source,
            'cost_cents' => 0,
            'looked_up_at' => now(),
        ]);
    }

    private static function extractCallerName($result): ?string
    {
        $cn = $result->callerName ?? null;
        if (is_array($cn)) return $cn['caller_name'] ?? null;
        if (is_object($cn)) return $cn->caller_name ?? $cn->callerName ?? null;
        return null;
    }

    private static function extractCallerType($result): ?string
    {
        $cn = $result->callerName ?? null;
        $type = is_array($cn) ? ($cn['caller_type'] ?? null) : (is_object($cn) ? ($cn->caller_type ?? $cn->callerType ?? null) : null);
        if (!$type) return null;
        $lower = strtolower($type);
        // DB enum is ('business','consumer'). Twilio sometimes returns
        // 'undetermined' or other values for unverified numbers — coerce
        // anything outside the enum to null. The raw value is still
        // preserved in the `payload` JSON column for forensics.
        return in_array($lower, ['business', 'consumer'], true) ? $lower : null;
    }

    private static function extractLineType($result): ?string
    {
        $lt = $result->lineTypeIntelligence ?? null;
        if (is_array($lt)) return $lt['type'] ?? null;
        if (is_object($lt)) return $lt->type ?? null;
        return null;
    }

    private static function extractCarrierName($result): ?string
    {
        $lt = $result->lineTypeIntelligence ?? null;
        if (is_array($lt)) return $lt['carrier_name'] ?? null;
        if (is_object($lt)) return $lt->carrier_name ?? $lt->carrierName ?? null;
        return null;
    }

    private static function normalizePayload($result): array
    {
        // Twilio SDK returns a typed object — cast to array for JSON storage.
        try {
            return json_decode(json_encode($result), true) ?: [];
        } catch (\Throwable) {
            return [];
        }
    }
}
