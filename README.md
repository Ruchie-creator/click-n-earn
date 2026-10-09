# Click & Earn

Click & Earn is a React/Vite client with a Laravel API. The app handles task reservations, proof review, a server-owned ledger, referrals, and payouts. Production infrastructure and credentials are intentionally not configured by this repository.

## Local development

For local app work, use the PostgreSQL database already configured in `backend/.env` (this setup uses `click_and_earn`). There is no separate development database to maintain. PHPUnit is the exception: it must use the isolated `click_and_earn_test` database because `RefreshDatabase` resets test data. Never run PHPUnit against the app database.

Before local migrations or demo-data commands, check `APP_ENV`, `DB_CONNECTION`, and `DB_DATABASE` in `backend/.env` and make sure they point to your local database, not a shared or production database.

Start the API in one terminal:

```powershell
cd C:\product-marketplace\backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
php artisan key:generate
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8001
```

`--seed` creates clearly fictional local-development accounts, tasks, proofs, and payouts. It is guarded against `APP_ENV=production`; never seed production. The seed passwords and data are not production credentials or real financial activity.

In a second terminal, run the frontend:

```powershell
cd C:\product-marketplace
npm ci
npm run dev
```

## Controlled client preview demo data

Demo records are stored in the database and tagged with a dedicated batch UUID; they are not frontend fixtures. For local testing, they use the database selected by `backend/.env` (here, `click_and_earn`). An isolated staging preview works the same way using that environment's `.env`. Enable `CLIENT_PREVIEW=true`, `DEMO_DATA_ENABLED=true`, and `PAYOUT_DRIVER=fake`, and configure three different secrets using `DEMO_MEMBER_PASSWORD`, `DEMO_MEMBER_TWO_PASSWORD`, and `DEMO_ADMIN_PASSWORD`. Each password must be at least 12 characters. The committed examples contain no usable demo passwords, and demo login emails use the reserved `.example` domain. Production rejects demo operations and must keep both demo flags false.

The preview frontend should be built with `VITE_CLIENT_PREVIEW=true` (see `.env.preview.example`); production builds must use `VITE_CLIENT_PREVIEW=false`. The preview indicator and Admin Settings demo controls are visible only in that preview build. Backend production boot rejects either demo flag being enabled, and demo operations require the fake payout provider.

```powershell
cd C:\product-marketplace
$env:VITE_API_URL = '/api'
$env:VITE_CLIENT_PREVIEW = 'true'
npm run build
```

```powershell
cd C:\product-marketplace\backend
php artisan migrate --force
php artisan demo:seed
php artisan demo:status
php artisan demo:clear
```

`demo:clear` prompts before deleting. Use `php artisan demo:clear --force` only for an intentional scripted cleanup. The Admin Settings refresh/delete actions require typing `REFRESH DEMO DATA` or `CLEAR DEMO DATA`. Cleanup removes only records tagged with the configured demo batch, its preview proof files, and that batch's login tokens/sessions; it stops without deleting if it finds unmarked records attached to demo-owned entities. Do not run demo commands against a production database.

The demo member emails are `demo.member@clickearn.example` and `demo.member2@clickearn.example`; the admin email is `demo.admin@clickearn.example`. Their passwords are environment-configured and must be shared with client reviewers through a secure channel, not committed to this repository.

The root `.env.example` points local Vite development at `http://127.0.0.1:8001/api`. Vite uses `VITE_API_URL` when supplied; otherwise the client falls back to that local API only in development and to same-origin `/api` in production. Auth uses a Sanctum bearer token stored by the browser client.

## Tests and database safety

The PHPUnit configuration defaults to `APP_ENV=testing`, PostgreSQL, `DB_DATABASE=click_and_earn_test`, and an empty `DB_URL` only when those variables are not already set. It deliberately does not override an explicitly supplied database connection/name/URL: the Laravel test bootstrap and application provider refuse to start when anything other than the isolated test database is selected. Tests also refuse to run with cached Laravel configuration. `RefreshDatabase` may reset data in the test database; it must never be pointed at `click_and_earn` or another application database.

```powershell
cd C:\product-marketplace\backend
php artisan test
```

If the local backend `.env` selects an application database, explicitly set the isolated test configuration before running tests:

```powershell
$env:APP_ENV = 'testing'
$env:DB_CONNECTION = 'pgsql'
$env:DB_DATABASE = 'click_and_earn_test'
$env:DB_URL = ''
php artisan test
```

Do not point the command at an application database. If the safety guard refuses to run, stop and inspect the test configuration rather than bypassing the guard.

## Local background services

Local defaults use the fake payout provider and private local proof storage. To exercise the fake payout states, set `FAKE_PAYOUT_OUTCOME` to `processing`, `paid`, or `failed` in the local backend environment. A queue worker and scheduler are needed to exercise asynchronous flows:

```powershell
cd C:\product-marketplace\backend
php artisan queue:work
```

```powershell
cd C:\product-marketplace\backend
php artisan schedule:work
```

The local mailer uses Laravel's `log` driver; it is not production delivery. Email verification is optional/future hardening and the current API returns `501` rather than claiming verification succeeded.

## Frontend production build

Set the API URL in the build environment or in an untracked `.env.production` file. Prefer same-origin `/api`; a separate API must use its public HTTPS URL. No production domain is assumed by this project.

```powershell
cd C:\product-marketplace
$env:VITE_API_URL = '/api'
$env:VITE_CLIENT_PREVIEW = 'false'
npm run build
```

`npm run build` runs the TypeScript project checks and a release scan. Production builds fail if the API points to a loopback host or if local addresses/development ports or known sample records are present in the generated bundle. `.env.production.example` documents the recommended same-origin value. Never place secrets or provider credentials in a `VITE_*` variable; Vite values are public in the client bundle.

## Production configuration gate

Phase 1 hardens code but does not deploy or configure production. Before a production release, Phase 2 must provide and verify:

- `APP_ENV=production`, `APP_DEBUG=false`, a securely generated `APP_KEY`, and a public HTTPS `APP_URL`;
- production PostgreSQL, backups, migrations, and operational access;
- HTTPS frontend origins in `FRONTEND_URL`/CORS and the appropriate `VITE_API_URL` at build time;
- a durable private proof-storage disk (`PROOF_STORAGE_DISK`, with provider settings kept server-side);
- a real mail provider (`MAIL_MAILER` must not be `log`), a persistent queue worker, and a scheduler;
- an explicitly approved payout configuration. Production boot requires `PAYOUT_DRIVER=airwallex`, `AIRWALLEX_ENVIRONMENT=production`, production credentials and webhook secret, and the official production API base URL. Fake payouts remain for local/testing only; Airwallex sandbox remains available for non-production testing;
- the public Airwallex webhook endpoint `/api/webhooks/airwallex`, provider-side signing configuration, monitoring, reconciliation, and an approved process to provision the initial administrator securely.

The API currently exposes email/password reset routes, but email verification is not implemented and is not treated as an approved release blocker. See `backend/.env.example` for variable names; it contains local/sample values only. Never copy sample values or test credentials into production.
