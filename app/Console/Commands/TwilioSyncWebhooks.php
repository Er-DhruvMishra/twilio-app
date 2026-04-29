<?php

namespace App\Console\Commands;

use App\Services\Twilio\NumberProvisioner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class TwilioSyncWebhooks extends Command
{
    protected $signature = 'twilio:sync-webhooks
                            {--url= : Override the webhook base URL (defaults to WEBHOOK_BASE_URL or APP_URL)}
                            {--write-env : Persist --url back into .env as WEBHOOK_BASE_URL}';
    protected $description = "Push the current webhook base URL into the Twilio number's voice/sms/status webhooks";

    public function handle(NumberProvisioner $provisioner): int
    {
        $base = rtrim($this->option('url') ?: env('WEBHOOK_BASE_URL') ?: config('app.url'), '/');

        if (!str_starts_with($base, 'http')) {
            $this->error("Base URL must start with http(s)://. Got: {$base}");
            return self::FAILURE;
        }

        $voiceUrl = "{$base}/webhooks/twilio/voice/incoming";
        $smsUrl = "{$base}/webhooks/twilio/sms/incoming";
        $statusCallback = "{$base}/webhooks/twilio/voice/status";
        $outgoingTwimlAppUrl = "{$base}/webhooks/twilio/voice/outgoing";

        $this->info("Syncing Twilio webhooks to base URL: {$base}");

        try {
            $result = $provisioner->syncWebhooks($voiceUrl, $smsUrl, $statusCallback);
            $provisioner->ensureTwiMLApp($outgoingTwimlAppUrl);
        } catch (\Throwable $e) {
            $this->error("Sync failed: {$e->getMessage()}");
            return self::FAILURE;
        }

        if ($this->option('write-env') && $this->option('url')) {
            $this->writeEnv('WEBHOOK_BASE_URL', $base);
            $this->line("  → wrote WEBHOOK_BASE_URL={$base} to .env");
        }

        $this->info("Synced number {$result['sid']}");
        $this->line("  Voice incoming:  {$voiceUrl}");
        $this->line("  SMS incoming:    {$smsUrl}");
        $this->line("  Status callback: {$statusCallback}");
        $this->line("  TwiML app voice: {$outgoingTwimlAppUrl}");
        return self::SUCCESS;
    }

    private function writeEnv(string $key, string $value): void
    {
        $path = base_path('.env');
        $contents = file_get_contents($path);
        $line = "{$key}={$value}";
        if (preg_match("/^{$key}=.*/m", $contents)) {
            $contents = preg_replace("/^{$key}=.*/m", $line, $contents);
        } else {
            $contents .= PHP_EOL . $line . PHP_EOL;
        }
        file_put_contents($path, $contents);

        // Drop any cached config so the next request boots from the fresh .env.
        // (The running `php artisan serve` process still needs to be restarted
        // separately — DevStart handles that.)
        try {
            Artisan::call('config:clear');
        } catch (\Throwable) {
            // ignore — clearing is best-effort
        }
    }
}
