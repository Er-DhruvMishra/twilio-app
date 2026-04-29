<?php

namespace App\Services\Twilio;

use App\Models\AutoReplyRule;
use App\Models\Message;

class AutoReplyEvaluator
{
    public function __construct(private SmsSender $sender) {}

    /** Picks the highest-priority rule that matches and ships an auto-reply. */
    public function evaluate(Message $inbound): ?Message
    {
        if (!$inbound->user_id) return null;

        $rules = AutoReplyRule::where('user_id', $inbound->user_id)
            ->where('is_enabled', true)
            ->orderBy('priority')
            ->get();

        foreach ($rules as $rule) {
            if ($this->matches($rule, $inbound)) {
                return $this->sender->send(
                    $inbound->user,
                    $inbound->from_e164,
                    $this->renderBody($rule->body, $inbound),
                );
            }
        }
        return null;
    }

    private function matches(AutoReplyRule $rule, Message $inbound): bool
    {
        $config = $rule->match_value ?? [];
        $body = trim((string) $inbound->body);

        return match ($rule->match_type) {
            'always' => true,

            'keyword' => collect($config['keywords'] ?? [])
                ->filter()
                ->contains(fn ($k) => mb_stripos($body, (string) $k) !== false),

            'first_contact' => Message::where('user_id', $inbound->user_id)
                ->where('thread_key', $inbound->thread_key)
                ->where('id', '<', $inbound->id)
                ->doesntExist(),

            'outside_hours' => self::isOutsideHours(
                $config['weekdays'] ?? [1, 2, 3, 4, 5],
                $config['start'] ?? '09:00',
                $config['end'] ?? '17:00',
                $config['tz'] ?? config('app.timezone', 'UTC'),
            ),

            default => false,
        };
    }

    private function renderBody(string $tpl, Message $inbound): string
    {
        return strtr($tpl, [
            '{from}' => $inbound->from_e164,
            '{contact_name}' => $inbound->contact?->display_name ?? '',
            '{body}' => (string) $inbound->body,
        ]);
    }

    private static function isOutsideHours(array $weekdays, string $start, string $end, string $tz): bool
    {
        try {
            $now = now($tz);
        } catch (\Throwable) {
            $now = now();
        }
        // ISO weekday: 1 (Mon) .. 7 (Sun)
        if (!in_array((int) $now->isoWeekday(), array_map('intval', $weekdays), true)) {
            return true;
        }
        $today = $now->format('H:i');
        return $today < $start || $today >= $end;
    }
}
