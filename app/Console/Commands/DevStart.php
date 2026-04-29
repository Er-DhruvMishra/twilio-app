<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

/**
 * One-shot dev orchestrator.
 *
 *   php artisan dev:start
 *
 * Spawns:
 *   • php artisan serve              (port 8000)
 *   • npm run dev                    (Vite, port 5173)
 *   • php artisan reverb:start       (port 8080)
 *   • php artisan queue:work
 *   • php artisan ngrok              (tunnels APP_URL host:port)
 *
 * Once ngrok comes up, it polls http://127.0.0.1:4040/api/tunnels for the
 * public https URL, writes it to .env as WEBHOOK_BASE_URL, and runs
 * `php artisan twilio:sync-webhooks` so Twilio knows where to send things.
 *
 * Stop with Ctrl+C — all child processes are torn down.
 */
class DevStart extends Command
{
    protected $signature = 'dev:start
                            {--no-ngrok : Skip starting ngrok and skip webhook sync}
                            {--no-vite : Skip starting Vite}
                            {--no-queue : Skip starting the queue worker}
                            {--no-reverb : Skip starting Reverb}
                            {--app-port=8000}';

    protected $description = 'Start the full local dev stack (serve + vite + reverb + queue + ngrok) and sync Twilio webhooks';

    /** @var array<string, Process> */
    private array $processes = [];

    public function handle(): int
    {
        $appPort = (string) $this->option('app-port');

        $this->info('--- Virtual Phone OS — dev stack ---');
        $this->line('');

        $this->spawn('serve', ['php', 'artisan', 'serve', '--port=' . $appPort], color: 'cyan');

        if (!$this->option('no-vite')) {
            $this->spawn('vite', ['npm', 'run', 'dev'], color: 'magenta');
        }
        if (!$this->option('no-reverb')) {
            $this->spawn('reverb', ['php', 'artisan', 'reverb:start', '--debug'], color: 'yellow');
        }
        if (!$this->option('no-queue')) {
            $this->spawn('queue', ['php', 'artisan', 'queue:work', '--tries=3', '--sleep=1'], color: 'blue');
        }
        if (!$this->option('no-ngrok')) {
            $this->spawn('ngrok', ['php', 'artisan', 'ngrok', '--port=' . $appPort], color: 'green');

            $this->line('');
            $this->info('Waiting for ngrok tunnel…');
            $publicUrl = $this->waitForNgrokTunnel(timeoutSeconds: 30);
            if ($publicUrl) {
                $this->info("ngrok ready: {$publicUrl}");
                $this->call('twilio:sync-webhooks', ['--url' => $publicUrl, '--write-env' => true]);

                // The serve child loaded .env at boot — restart it so the new
                // WEBHOOK_BASE_URL is live in PHP for the next request.
                if (isset($this->processes['serve']) && $this->processes['serve']->isRunning()) {
                    $this->info('Restarting serve to pick up new WEBHOOK_BASE_URL…');
                    $this->processes['serve']->stop(3);
                    unset($this->processes['serve']);
                    $this->spawn('serve', ['php', 'artisan', 'serve', '--port=' . $appPort], color: 'cyan');
                }
            } else {
                $this->warn('Could not detect an ngrok tunnel after 30s. Webhooks NOT synced — run `php artisan twilio:sync-webhooks --url=<https-ngrok-url> --write-env` manually once ngrok is up.');
            }
        }

        $this->line('');
        $this->info('All services running. Press Ctrl+C to stop everything.');
        $this->line('');

        return $this->loop();
    }

    private function spawn(string $name, array $command, string $color = 'white'): void
    {
        $process = new Process($command, base_path(), null, null, null);
        $process->setTimeout(null);
        $process->setIdleTimeout(null);
        $process->start(function ($_type, $buffer) use ($name, $color) {
            $tag = "<fg={$color}>[{$name}]</> ";
            foreach (preg_split('/\R/', rtrim($buffer)) as $line) {
                if ($line === '') continue;
                $this->getOutput()->writeln($tag . $line);
            }
        });
        $this->processes[$name] = $process;
        $this->line("  spawned: {$name}");
    }

    private function waitForNgrokTunnel(int $timeoutSeconds): ?string
    {
        $deadline = microtime(true) + $timeoutSeconds;
        while (microtime(true) < $deadline) {
            try {
                $resp = @file_get_contents('http://127.0.0.1:4040/api/tunnels');
                if ($resp) {
                    $data = json_decode($resp, true);
                    foreach ($data['tunnels'] ?? [] as $t) {
                        if (str_starts_with($t['public_url'] ?? '', 'https://')) {
                            return rtrim($t['public_url'], '/');
                        }
                    }
                }
            } catch (\Throwable) {
                // ignore
            }
            usleep(500_000); // 0.5s
        }
        return null;
    }

    private function loop(): int
    {
        // Trap signals on POSIX. Windows lacks the pcntl extension entirely
        // and instead relies on Ctrl+C propagating to the child processes.
        if (function_exists('pcntl_async_signals') && defined('SIGINT')) {
            \call_user_func('pcntl_async_signals', true);
            \call_user_func('pcntl_signal', \constant('SIGINT'), fn () => $this->shutdown());
            \call_user_func('pcntl_signal', \constant('SIGTERM'), fn () => $this->shutdown());
        }

        while (true) {
            foreach ($this->processes as $name => $process) {
                if (!$process->isRunning()) {
                    $this->warn("[{$name}] exited (code " . ($process->getExitCode() ?? '?') . ")");
                    unset($this->processes[$name]);
                }
            }
            if (empty($this->processes)) {
                $this->info('All processes stopped.');
                return self::SUCCESS;
            }
            usleep(500_000);
        }
    }

    private function shutdown(): void
    {
        $this->line('');
        $this->info('Shutting down…');
        foreach ($this->processes as $name => $process) {
            if ($process->isRunning()) {
                $this->line("  stopping {$name}…");
                $process->stop(5);
            }
        }
        exit(0);
    }
}
