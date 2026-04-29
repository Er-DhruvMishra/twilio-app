<?php

namespace App\Console\Commands;

use App\Services\Fax\FaxPlusService;
use App\Support\WebhookUrl;
use Illuminate\Console\Command;

class FaxPlusSyncWebhooks extends Command
{
    protected $signature = 'faxplus:sync-webhooks';
    protected $description = 'Point fax.plus webhooks at the current WEBHOOK_BASE_URL. Mirrors twilio:sync-webhooks.';

    public function handle(FaxPlusService $service): int
    {
        $statusUrl = WebhookUrl::for('webhooks/faxplus/status');
        $inboundUrl = WebhookUrl::for('webhooks/faxplus/inbound');
        $this->info("Syncing fax.plus webhooks → {$statusUrl} / {$inboundUrl}");

        try {
            $service->syncWebhooks($statusUrl, $inboundUrl);
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            return Command::FAILURE;
        }

        $this->info('Done.');
        return Command::SUCCESS;
    }
}
