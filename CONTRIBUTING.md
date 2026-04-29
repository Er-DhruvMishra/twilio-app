# Contributing

Thanks for taking the time to contribute. This document is short and
practical — the project's not huge, the conventions are not subtle.

## Setup

See [docs/INSTALLATION.md](docs/INSTALLATION.md). Once installed, run:

```bash
composer install
npm install --legacy-peer-deps
php artisan migrate --seed
php artisan dev:start
```

## House rules

- **Edit existing files** rather than creating new ones whenever
  possible. New abstraction layers, new helpers, new directories — all
  need a clear reason.
- **No comments that explain WHAT the code does**. Well-named
  identifiers do that. Comments are for *why* — non-obvious
  constraints, workarounds for upstream bugs, surprising decisions.
- **No backwards-compatibility shims**. If we delete a field, we delete
  it everywhere; we don't leave `// removed in v2` markers.
- **Trust internal code**. Validate at system boundaries (user input,
  webhooks, third-party APIs) — not between our own services.
- **The plan + memory live in `~/.claude/plans/` and
  `~/.claude/projects/c--xampp-htdocs-twilio-app/memory/`**. Read those
  before opening a PR if you're touching architectural decisions.

## Testing

The project doesn't have a test suite yet — verification is manual via
the checklist in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).
PRs that add a Pest / PHPUnit suite for the most-trafficked services
(`CallRoutingService`, `LookupService`, `SendGridService`,
`FaxPlusService`) are welcome.

## Lint / format

Backend PHP files must pass `php -l`. Frontend must pass `npm run build`
(which runs `tsc` + `vite build` + the service worker bundle).

## Commit style

One concern per commit, present-tense imperative subject ≤ 72 chars,
optional body explaining *why*. No emoji-prefixes or "feat:/fix:"
discriminators required, but if you've been using them
keep doing it.

```
Speed up dialer suggest by skipping T9 conversion for plain text
queries

The fallback regexp on every Contact list row was ~300% of the
total endpoint cost on a 5k-contact tenant. T9 conversion only
applies to digits-only queries; bypass it otherwise.
```

## Where to land changes

| Concern | File / area |
|---|---|
| New Twilio integration | `app/Services/Twilio/` |
| New webhook handler | `app/Http/Controllers/Webhooks/` + register in `routes/webhooks.php` |
| New Inertia page | `resources/js/Pages/<App>/<Page>.tsx` + register in `routes/web.php` |
| New permission | `database/seeders/RolesAndPermissionsSeeder.php` (re-run seeder after migrating) |
| Real-time event | `app/Events/<Name>.php` implementing `ShouldBroadcastNow` |
| Web Push notification | `app/Notifications/<Name>Notification.php` + service worker `resources/js/sw.ts` |
| Per-module debug log | `App\Services\Debug\DebugLogger::log('<module>', ...)` at the API boundary |

## Pull request review

We look for:

1. **Does it work?** — manual smoke test described in the PR
   description.
2. **Does it scope creep?** — refactors and bug fixes belong in
   separate PRs from feature work.
3. **Does it leak secrets?** — no `dd()` / `dump()` left in. New
   logging goes through `DebugLogger::trace` with proper redaction.
4. **Does it respect the per-user scoping?** — admin sees-all is the
   trait `ScopedToUser`, not a manual `isAdmin()` check.
