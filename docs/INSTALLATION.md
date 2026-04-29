# Installation guide (local development)

This is the canonical XAMPP-on-Windows path the project was originally
built and tested against. macOS / Linux work the same once PHP 8.2,
MySQL 8, Node 20, and Composer 2 are on `PATH` — substitute paths as
needed.

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| PHP | 8.2+ | XAMPP 8.2.x ships this; verify `php -v` |
| MySQL | 8.0+ | bundled with XAMPP |
| Composer | 2.x | https://getcomposer.org |
| Node | 20.x LTS | https://nodejs.org |
| ngrok | latest | https://ngrok.com — free tier OK; standalone binary recommended over MSIX (the MSIX panics on startup) |
| Git | any | optional but expected |

A free Twilio account is required to actually place / receive calls.
Optional: SendGrid account (for Mail), fax.plus account (for Fax).

## 2. Clone + install

```powershell
cd c:\xampp\htdocs
git clone <your-repo-url> twilio-app
cd twilio-app

composer install
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is needed because `@twilio/voice-sdk` and a
couple of other packages have stricter peer-dep declarations than newer
React / TS versions strictly satisfy.

## 3. Database

Open phpMyAdmin (`http://localhost/phpmyadmin`) and create a database:

```sql
CREATE DATABASE twilio_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

(Or via CLI: `mysql -u root -e "CREATE DATABASE twilio_app ..."`.)

## 4. Configure `.env`

```powershell
copy .env.example .env
php artisan key:generate
```

Edit `.env` and set at minimum:

```dotenv
APP_NAME="Virtual Phone OS"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=twilio_app
DB_USERNAME=root
DB_PASSWORD=

# Reverb (WebSocket server) — auto-populated by reverb:install but must be set
REVERB_APP_ID=local
REVERB_APP_KEY=local-key
REVERB_APP_SECRET=local-secret
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database

# Web Push — generate with: php artisan webpush:vapid
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com

# Webhooks — fed by `php artisan dev:start` once ngrok comes up.
WEBHOOK_BASE_URL=
TWILIO_VALIDATE_SIGNATURE=false   # disable in dev to ease testing
```

For the Twilio / SendGrid / fax.plus credentials see
[CONFIGURATION.md](CONFIGURATION.md) — those are entered in the **UI**
after first login, not in `.env`.

### Generate VAPID keys for Web Push

```powershell
php artisan webpush:vapid
```

If `php artisan webpush:vapid` errors with `Unable to create the key`,
your OpenSSL config isn't on `PATH`. Set it temporarily:

```powershell
$env:OPENSSL_CONF = "c:/xampp/apache/conf/openssl.cnf"
php artisan webpush:vapid
```

Then copy the printed `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
`VAPID_SUBJECT` into `.env`.

## 5. Migrate + seed

```powershell
php artisan migrate
php artisan db:seed --class=RolesAndPermissionsSeeder
```

The seeder creates the `admin` and `agent` roles with their default
permission sets (29 permissions across all modules).

To create your first admin user:

```powershell
php artisan tinker
```

```php
$u = \App\Models\User::create([
    'name' => 'Admin',
    'email' => 'admin@example.com',
    'password' => bcrypt('changeme'),
]);
$u->assignRole('admin');
$u->markEmailAsVerified();
exit
```

## 6. ngrok

Free tier ngrok gives you an HTTPS tunnel to `localhost:8000`, which
Twilio / fax.plus / SendGrid webhooks need. Either:

```powershell
# Option A: run ngrok manually
ngrok http 8000
# Note the https URL it prints, e.g. https://abc123.ngrok-free.app
```

Or just run `php artisan dev:start` (next step), which manages it for you.

## 7. Run the dev stack

The repo ships an artisan wrapper that starts everything in one shot:

```powershell
php artisan dev:start
```

This spawns five processes:

1. `php artisan serve` (HTTP on `:8000`)
2. `npm run dev` (Vite HMR)
3. `php artisan reverb:start` (WebSocket on `:8080`)
4. `php artisan queue:work` (jobs)
5. `php artisan ngrok` (HTTPS tunnel)

Once ngrok comes up it polls `http://127.0.0.1:4040/api/tunnels` for the
public URL, writes it to `WEBHOOK_BASE_URL` in `.env`, then runs
`php artisan twilio:sync-webhooks` so your Twilio number's `voiceUrl` /
`smsUrl` / `statusCallback` all repoint at the new tunnel automatically.

If you'd rather run pieces by hand, open five terminals and run those
commands separately (skip ngrok if you've got an alternative tunnel).

## 8. Open the app

http://127.0.0.1:8000/login — sign in with the user you created in step 5.

You should see the "Home" screen with app tiles. Some tiles will be
greyed-out / hidden until you complete the matching Settings wizard
(see [CONFIGURATION.md](CONFIGURATION.md)).

## 9. Verify everything

| Thing | How to verify |
|---|---|
| Migration count | `php artisan migrate:status` should show all green |
| Reverb | `php artisan reverb:start --debug` prints a connect line per browser tab |
| Queue | `php artisan queue:work --once` should consume zero jobs cleanly |
| Web Push | Settings → Notifications → "Test push" should fire an OS notification within 2s |
| Twilio webhook reachability | Twilio Console → your number → "Voice & Fax" should show your ngrok URL |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `php artisan ngrok` panics on startup | MSIX-installed ngrok | Download standalone binary, set `NGROK_BINARY=/path/to/ngrok.exe` in `.env` |
| Inertia visits 419 (CSRF) | Cookie domain | `SESSION_DOMAIN` and `SANCTUM_STATEFUL_DOMAINS` must include `127.0.0.1:8000` |
| Reverb echoes nothing | Ports 8080 firewalled | Allow inbound 8080 in Windows Firewall, or change `REVERB_PORT` |
| Twilio webhooks return 403 | Signature mismatch behind ngrok | In dev set `TWILIO_VALIDATE_SIGNATURE=false`; in prod ensure `TrustProxies = '*'` and HTTPS scheme is forced |
| `Refused to get unsafe header "phpdebugbar"` warning | Cross-origin XHR (Twilio CDN) | Already silenced in `bootstrap.ts` — hard-refresh after pulling |

For deeper diagnostics, **Settings → Debug logging** lets you toggle per-
module live API trace into `storage/logs/module-debug-YYYY-MM-DD.log`
without restarting.
