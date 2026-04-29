<?php

namespace App\Services\Analytics;

use App\Models\Call;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\ConversationMessage;
use App\Models\Fax;
use App\Models\Lookup;
use App\Models\Mail;
use App\Models\Message;
use App\Models\User;
use App\Models\VideoRecording;
use App\Models\VideoRoom;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class MetricsAggregator
{
    /** Returns a 30-day rollup for the given user (or admin = team-wide if null). */
    public function summary(?User $user, int $days = 30): array
    {
        $start = now()->subDays($days)->startOfDay();
        $end = now()->endOfDay();

        $callsQ = Call::whereBetween('started_at', [$start, $end]);
        $messagesQ = Message::whereBetween('created_at', [$start, $end]);
        if ($user && !$user->isAdmin()) {
            $callsQ->where('user_id', $user->id);
            $messagesQ->where('user_id', $user->id);
        }

        $totalCalls = (clone $callsQ)->count();
        $missed = (clone $callsQ)->where('disposition', 'missed')->count();
        $voicemail = (clone $callsQ)->where('is_voicemail', true)->count();
        $answered = (clone $callsQ)->whereIn('disposition', ['answered'])->count();
        $avgDuration = (clone $callsQ)->whereNotNull('duration_seconds')->avg('duration_seconds');

        $smsSent = (clone $messagesQ)->where('direction', 'outbound')->count();
        $smsReceived = (clone $messagesQ)->where('direction', 'inbound')->count();
        $smsFailed = (clone $messagesQ)->where('direction', 'outbound')->whereIn('status', ['failed', 'undelivered'])->count();

        return [
            'window' => ['start' => $start, 'end' => $end, 'days' => $days],
            'calls' => [
                'total' => $totalCalls,
                'answered' => $answered,
                'missed' => $missed,
                'voicemail' => $voicemail,
                'missedRate' => $totalCalls > 0 ? round($missed / $totalCalls, 3) : 0,
                'avgDurationSeconds' => $avgDuration ? (int) round($avgDuration) : 0,
            ],
            'sms' => [
                'sent' => $smsSent,
                'received' => $smsReceived,
                'failed' => $smsFailed,
            ],
            'mail' => $this->mailMetrics($user, $start, $end),
            'fax' => $this->faxMetrics($user, $start, $end),
            'lookup' => $this->lookupMetrics($user, $start, $end),
            'conversations' => $this->conversationsMetrics($user, $start, $end),
            'video' => $this->videoMetrics($user, $start, $end),
            'callsByDay' => $this->callsByDay($callsQ, $start, $end),
            'topContacts' => $this->topContacts($user, $start, $end),
            'agentBreakdown' => $user?->isAdmin() ? $this->agentBreakdown($start, $end) : null,
        ];
    }

    private function mailMetrics(?User $user, Carbon $start, Carbon $end): array
    {
        $q = Mail::whereBetween('created_at', [$start, $end]);
        if ($user && !$user->isAdmin()) $q->where('user_id', $user->id);
        return [
            'sent' => (clone $q)->where('direction', 'outbound')->count(),
            'received' => (clone $q)->where('direction', 'inbound')->count(),
            'delivered' => (clone $q)->whereIn('status', ['delivered', 'opened', 'clicked'])->count(),
            'opened' => (clone $q)->whereNotNull('opened_at')->count(),
            'clicked' => (clone $q)->whereNotNull('clicked_at')->count(),
            'bounced' => (clone $q)->where('status', 'bounced')->count(),
        ];
    }

    private function faxMetrics(?User $user, Carbon $start, Carbon $end): array
    {
        $q = Fax::whereBetween('created_at', [$start, $end]);
        if ($user && !$user->isAdmin()) $q->where('user_id', $user->id);
        return [
            'sent' => (clone $q)->where('direction', 'outbound')->count(),
            'received' => (clone $q)->where('direction', 'inbound')->count(),
            'success' => (clone $q)->where('status', 'success')->count(),
            'failed' => (clone $q)->where('status', 'failed')->count(),
            'totalPages' => (int) (clone $q)->sum('num_pages'),
            'spendCents' => (int) (clone $q)->sum('cost_cents'),
        ];
    }

    private function lookupMetrics(?User $user, Carbon $start, Carbon $end): array
    {
        $q = Lookup::whereBetween('looked_up_at', [$start, $end]);
        if ($user && !$user->isAdmin()) $q->where('requested_by_user_id', $user->id);
        return [
            'total' => (clone $q)->count(),
            'manualSearch' => (clone $q)->where('source', 'manual_search')->count(),
            'incomingManual' => (clone $q)->where('source', 'incoming_manual')->count(),
            'incomingAuto' => (clone $q)->where('source', 'incoming_auto')->count(),
            'outgoingManual' => (clone $q)->where('source', 'outgoing_manual')->count(),
            'outgoingAuto' => (clone $q)->where('source', 'outgoing_auto')->count(),
            'spendCents' => (int) (clone $q)->sum('cost_cents'),
        ];
    }

    private function conversationsMetrics(?User $user, Carbon $start, Carbon $end): array
    {
        $convQ = Conversation::whereBetween('created_at', [$start, $end]);
        $msgQ = ConversationMessage::whereBetween('created_at', [$start, $end]);
        if ($user && !$user->isAdmin()) {
            $convQ->where('owner_user_id', $user->id);
            $ownedConvIds = (clone $convQ)->pluck('id');
            $msgQ->whereIn('conversation_id', $ownedConvIds);
        }
        return [
            'total' => (clone $convQ)->count(),
            'byChannel' => (clone $convQ)
                ->select('channel', DB::raw('COUNT(*) as cnt'))
                ->groupBy('channel')
                ->pluck('cnt', 'channel')
                ->all(),
            'messagesSent' => (clone $msgQ)->count(),
        ];
    }

    private function videoMetrics(?User $user, Carbon $start, Carbon $end): array
    {
        $roomQ = VideoRoom::whereBetween('started_at', [$start, $end]);
        if ($user && !$user->isAdmin()) $roomQ->where('created_by_user_id', $user->id);

        return [
            'rooms' => (clone $roomQ)->count(),
            'totalMinutes' => (int) round(((clone $roomQ)->sum('duration_seconds') ?? 0) / 60),
            'recordings' => VideoRecording::whereIn('room_id', (clone $roomQ)->pluck('id'))->count(),
        ];
    }

    private function callsByDay($query, Carbon $start, Carbon $end): array
    {
        $rows = (clone $query)
            ->select(DB::raw('DATE(started_at) as day'), DB::raw('COUNT(*) as count'), DB::raw('SUM(direction = "inbound") as inbound'), DB::raw('SUM(direction = "outbound") as outbound'))
            ->groupBy('day')
            ->orderBy('day')
            ->get()
            ->keyBy('day');

        $out = [];
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $key = $d->format('Y-m-d');
            $row = $rows->get($key);
            $out[] = [
                'day' => $key,
                'count' => (int) ($row->count ?? 0),
                'inbound' => (int) ($row->inbound ?? 0),
                'outbound' => (int) ($row->outbound ?? 0),
            ];
        }
        return $out;
    }

    private function topContacts(?User $user, Carbon $start, Carbon $end): array
    {
        $callsQ = Call::whereBetween('started_at', [$start, $end])->whereNotNull('contact_id');
        if ($user && !$user->isAdmin()) $callsQ->where('user_id', $user->id);

        $top = $callsQ->select('contact_id', DB::raw('COUNT(*) as call_count'))
            ->groupBy('contact_id')
            ->orderByDesc('call_count')
            ->limit(10)
            ->get();

        $contacts = Contact::whereIn('id', $top->pluck('contact_id'))->get(['id', 'display_name', 'phone_e164'])->keyBy('id');
        return $top->map(fn ($r) => [
            'id' => $r->contact_id,
            'name' => $contacts[$r->contact_id]?->display_name ?? '?',
            'phone' => $contacts[$r->contact_id]?->phone_e164 ?? '',
            'calls' => (int) $r->call_count,
        ])->all();
    }

    private function agentBreakdown(Carbon $start, Carbon $end): array
    {
        $agg = Call::whereBetween('started_at', [$start, $end])
            ->select('user_id', DB::raw('COUNT(*) as calls'), DB::raw('SUM(disposition = "answered") as answered'), DB::raw('SUM(disposition = "missed") as missed'))
            ->groupBy('user_id')
            ->get();

        $users = User::whereIn('id', $agg->pluck('user_id')->filter())->get(['id', 'name'])->keyBy('id');
        return $agg->filter(fn ($a) => $a->user_id)
            ->map(fn ($a) => [
                'userId' => $a->user_id,
                'name' => $users[$a->user_id]?->name ?? '?',
                'calls' => (int) $a->calls,
                'answered' => (int) $a->answered,
                'missed' => (int) $a->missed,
            ])
            ->values()
            ->all();
    }
}
