<?php

namespace App\Jobs;

use App\Events\CallStatusUpdated;
use App\Models\Recording;
use App\Models\TwilioConfig;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class ProcessRecordingDownload implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;
    public int $backoff = 30;

    public function __construct(public int $recordingId) {}

    public function handle(): void
    {
        $recording = Recording::find($this->recordingId);
        if (!$recording) return;

        $config = TwilioConfig::active();
        if (!$config) return;

        $response = Http::withBasicAuth($config->account_sid_enc, $config->auth_token_enc)
            ->timeout(60)
            ->get($recording->media_url);

        if (!$response->ok()) {
            $recording->update(['status' => 'failed']);
            return;
        }

        $path = "recordings/{$recording->twilio_recording_sid}.mp3";
        Storage::disk('local')->put($path, $response->body());

        $recording->update([
            'local_path' => $path,
            'status' => 'completed',
        ]);

        if ($recording->call) {
            CallStatusUpdated::dispatch($recording->call->fresh());
        }
    }
}
