# Production deployment

This guide assumes a Linux VPS (Ubuntu 22.04 LTS or 24.04). The same
shape works on RHEL-family distros — substitute `apt` for `dnf` and
`/etc/nginx/sites-*` for `/etc/nginx/conf.d`.

## Topology

```
            ┌────────────────────────────────────────────┐
            │                  nginx (443)               │
            │  /          → php-fpm (Inertia + APIs)     │
            │  /webhooks/ → php-fpm (Twilio + partners)  │
            │  /broadcasting/auth → php-fpm (Reverb auth)│
            │  /reverb    → reverb:8080 (proxy_pass)     │
            └────────────────────────────────────────────┘
                          │
            ┌─────────────┼─────────────┬───────────────┐
            ▼             ▼             ▼               ▼
       php-fpm       reverb        queue:work     scheduler
       (8.2+)        (long-run)    (long-run)     (cron)
            │
            ▼
       ┌─────────┐
       │  MySQL  │
       └─────────┘
```

Long-running processes (`reverb:start`, `queue:work`, optional `horizon`)
are supervised by **systemd** units, not bare shell — they need clean
restart-on-crash behavior.

## 1. Server setup

```bash
sudo apt update && sudo apt install -y \
    nginx mysql-server \
    php8.2-fpm php8.2-mysql php8.2-mbstring php8.2-xml php8.2-curl \
    php8.2-zip php8.2-bcmath php8.2-gd php8.2-intl php8.2-redis \
    composer git unzip
# Node 20 from NodeSource:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Configure MySQL:

```bash
sudo mysql_secure_installation
sudo mysql -e "
    CREATE DATABASE twilio_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER 'phoneos'@'localhost' IDENTIFIED BY 'CHANGE_ME';
    GRANT ALL ON twilio_app.* TO 'phoneos'@'localhost';
    FLUSH PRIVILEGES;
"
```

## 2. Deploy code

```bash
sudo mkdir -p /var/www/phoneos
sudo chown -R deploy:www-data /var/www/phoneos
cd /var/www/phoneos
git clone <your-repo-url> .

# Backend
composer install --no-dev --optimize-autoloader

# Frontend
npm install --legacy-peer-deps
npm run build   # writes public/build/* + public/sw.js
```

## 3. Configure `.env`

```bash
cp .env.example .env
php artisan key:generate
nano .env
```

Required production values (different from dev):

```dotenv
APP_NAME="Virtual Phone OS"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://phoneos.example.com

DB_HOST=127.0.0.1
DB_DATABASE=twilio_app
DB_USERNAME=phoneos
DB_PASSWORD=CHANGE_ME

# Reverb behind nginx — public scheme is wss, internal is plain ws
REVERB_APP_ID=<random-id>
REVERB_APP_KEY=<32-char-key>
REVERB_APP_SECRET=<64-char-secret>
REVERB_HOST=phoneos.example.com
REVERB_PORT=443
REVERB_SCHEME=https

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

BROADCAST_CONNECTION=reverb
QUEUE_CONNECTION=database          # or redis with QUEUE_CONNECTION=redis
SESSION_DRIVER=database

# Twilio webhook URL is just APP_URL in production (no ngrok).
WEBHOOK_BASE_URL=https://phoneos.example.com
TWILIO_VALIDATE_SIGNATURE=true     # ENFORCE in prod

# Web Push
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:ops@example.com
```

Then:

```bash
php artisan migrate --force
php artisan db:seed --class=RolesAndPermissionsSeeder --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## 4. nginx vhost

`/etc/nginx/sites-available/phoneos.conf`:

```nginx
upstream phoneos_php {
    server unix:/var/run/php/php8.2-fpm.sock;
}

upstream phoneos_reverb {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name phoneos.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name phoneos.example.com;

    ssl_certificate     /etc/letsencrypt/live/phoneos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/phoneos.example.com/privkey.pem;

    root /var/www/phoneos/public;
    index index.php;

    # Reverb upgrade — must come BEFORE the catch-all PHP block.
    location /reverb {
        proxy_pass http://phoneos_reverb;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 60s;
    }
    # Reverb's broadcasting auth + apps endpoints stay PHP.
    location ~* ^/(broadcasting/auth|apps/) {
        try_files $uri /index.php?$query_string;
        # ... php-fpm block from below ...
    }

    # Static assets (Vite output) — long-cache
    location ^~ /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    location = /sw.js { try_files $uri =404; add_header Cache-Control "no-cache"; }

    # Everything else → Laravel
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass phoneos_php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param HTTP_X_FORWARDED_PROTO https;
        client_max_body_size 32M;
    }

    # Don't serve dotfiles or vendor.
    location ~ /\. { deny all; }
    location ~ ^/(vendor|storage|app)/ { deny all; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/phoneos.conf /etc/nginx/sites-enabled/
sudo certbot --nginx -d phoneos.example.com
sudo nginx -t && sudo systemctl reload nginx
```

## 5. systemd units

`/etc/systemd/system/phoneos-reverb.service`:

```ini
[Unit]
Description=Virtual Phone OS — Reverb WebSocket server
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/phoneos
ExecStart=/usr/bin/php artisan reverb:start --host=127.0.0.1 --port=8080
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/phoneos-queue.service`:

```ini
[Unit]
Description=Virtual Phone OS — queue worker
After=network.target mysql.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/phoneos
ExecStart=/usr/bin/php artisan queue:work --queue=push,default --sleep=0 --tries=3 --max-time=3600
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

The `--queue=push,default --sleep=0` is important so Web Push notifications
for incoming calls aren't delayed by the queue worker's sleep cycle.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now phoneos-reverb phoneos-queue
sudo systemctl status phoneos-reverb phoneos-queue
```

## 6. Cron (Laravel scheduler)

`/etc/cron.d/phoneos`:

```cron
* * * * * www-data cd /var/www/phoneos && php artisan schedule:run >> /dev/null 2>&1
```

This runs the scheduler every minute. The scheduler dispatches:

- `billing:snapshot` every 6 hours (Twilio Usage + Balance cache)

## 7. First-run setup

Browse to `https://phoneos.example.com/login`, sign in as the seeded admin
(or create one via `php artisan tinker` as in the install guide), then
walk the wizards in [CONFIGURATION.md](CONFIGURATION.md):

1. Settings → Twilio (Account SID + Auth Token)
2. Settings → Phone Numbers (buy or pick a number — webhooks auto-config'd to `APP_URL`)
3. Settings → Notifications (Web Push subscribe)
4. Optional: Settings → Mail / Fax / Conversations / Video

## 8. Updates

```bash
cd /var/www/phoneos
git pull
composer install --no-dev --optimize-autoloader
npm install --legacy-peer-deps
npm run build
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
sudo systemctl restart phoneos-reverb phoneos-queue php8.2-fpm
```

## Hardening checklist

- [ ] `APP_DEBUG=false`
- [ ] `TWILIO_VALIDATE_SIGNATURE=true`, `FAXPLUS_VALIDATE_SIGNATURE=true`,
      `SENDGRID_VALIDATE_SIGNATURE=true`
- [ ] HTTPS enforced (HSTS in nginx)
- [ ] MySQL bind to 127.0.0.1 only
- [ ] Webhooks rate-limited via the `throttle:webhooks` middleware (already
      in `bootstrap/app.php`)
- [ ] `storage/logs/module-debug-*.log` rotated by Laravel's daily driver;
      consider clearing on deploy
- [ ] Reverb credentials (`REVERB_APP_KEY`, `REVERB_APP_SECRET`) rotated
      from defaults
- [ ] `Access-Control-Expose-Headers` middleware (already shipped) doesn't
      leak any non-debugbar headers in production — debugbar is auto-disabled
      when `APP_DEBUG=false`
- [ ] Backup MySQL nightly (`mysqldump twilio_app | gzip > /backups/...`)

## Scaling notes

- The queue worker is the bottleneck for inbound burst traffic. Run a
  separate `phoneos-queue@2.service` (etc.) for parallelism.
- Reverb is single-process; for >1k concurrent WS connections,
  switch to `BROADCAST_CONNECTION=pusher` with a managed Pusher service.
- MySQL: index review every 100k rows of `calls`, `messages`, `mails`
  — the schema ships with sensible compound indexes but heavy use
  patterns may benefit from per-tenant adjustments.
