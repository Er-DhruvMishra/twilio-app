<?php

namespace App\Console;

use JnJairo\Laravel\Ngrok\NgrokProcessBuilder as BaseBuilder;
use Symfony\Component\Process\Process;

class NgrokProcessBuilder extends BaseBuilder
{
    public function buildProcess(
        string $hostHeader = '',
        string $port = '80',
        string $host = '',
        array $extra = [],
    ): Process {
        $binary = (string) env('NGROK_PATH', 'ngrok');

        if ($region = env('NGROK_REGION')) {
            $extra = array_merge($extra, ['--region', $region]);
        }
        if ($domain = env('NGROK_DOMAIN')) {
            $extra = array_merge($extra, ['--domain', $domain]);
        }

        $command = [$binary, 'http', '--log', 'stdout', ...$extra];

        if ($hostHeader !== '') {
            $command[] = '--host-header';
            $command[] = $hostHeader;
        }

        $command[] = $host !== '' ? "{$host}:" . ($port ?: '80') : ($port ?: '80');

        $env = [];
        if ($authtoken = env('NGROK_AUTHTOKEN')) {
            $env['NGROK_AUTHTOKEN'] = $authtoken;
        }

        $process = new Process($command, $this->getWorkingDirectory(), $env ?: null, null, null);
        $process->setTimeout(null);
        $process->setIdleTimeout(null);
        return $process;
    }
}
