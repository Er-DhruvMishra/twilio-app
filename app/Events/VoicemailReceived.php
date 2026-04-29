<?php

namespace App\Events;

use App\Models\Voicemail;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VoicemailReceived implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Voicemail $voicemail) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->voicemail->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'VoicemailReceived';
    }

    public function broadcastWith(): array
    {
        return [
            'voicemailId' => $this->voicemail->id,
            'callId' => $this->voicemail->call_id,
            'recordingId' => $this->voicemail->recording_id,
            'duration' => $this->voicemail->recording?->duration_seconds,
            'transcript' => $this->voicemail->transcript,
            'from' => $this->voicemail->call?->from_e164,
        ];
    }
}
