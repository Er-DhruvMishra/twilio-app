#!/usr/bin/env bash
# Keeps the Laravel Reverb WebSocket server (port 6001) alive.
# Invoked every minute from crontab; starts Reverb only if it isn't running.
# Reverb needs PHP 8.3 — the system `php` is 7.4, so we call lsphp83 explicitly.
set -euo pipefail

APP_DIR=/home/twilio.in.net/public_html
PHP=/usr/local/lsws/lsphp83/bin/php

cd "$APP_DIR" || exit 1

# Already running? Nothing to do.
if pgrep -f "artisan reverb:start" >/dev/null 2>&1; then
    exit 0
fi

# Replace this cron-spawned process with Reverb so it stays alive in the
# foreground; the next minute's tick will see it via pgrep and exit early.
exec "$PHP" artisan reverb:start --host=127.0.0.1 --port=6001
