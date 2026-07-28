# SynCash Production Deployment Report

Report date: 2026-07-28

Target: `app.syncash.co.il`

Branch: `codex-syncash-production-rebuild`

Prepared release: `48233d9dba6d`

Status: **Infrastructure, the private application runtime and the maintenance site are active; public activation remains blocked by SMTP configuration.**

## Production State

| Component | Status | Notes |
| --- | --- | --- |
| PostgreSQL | PASS | Healthy, migrated, private network only, dedicated volume, no seed data |
| Redis | PASS | Healthy, authenticated, private network only, dedicated volume |
| MinIO | PASS | Healthy, private network only, dedicated volume and application bucket initialized |
| API | PASS | Healthy on loopback only; private runtime verification passed and public Nginx access remains blocked |
| Frontend | PASS | Healthy on loopback only; direct SPA routes passed |
| Worker | DISABLED | Intentionally stopped while email delivery is disabled |
| Firebase | PASS | ADC, Admin SDK, Email/Password, ID-token verification and authorized domain passed |
| Secret Manager access | PASS | Both required existing secrets are readable with the configured read-only identity |
| Encryption secret format | PASS | A new version of the existing secret is canonical Base64 and decodes to exactly 32 bytes |
| Nginx | PASS | Configuration test and reload passed |
| Maintenance mode | PASS | HTTP redirects permanently to HTTPS; HTTPS and all public API routes return the Hebrew maintenance page with status 503 |
| DNS | PASS | The application host resolves to the Production server through the server resolver, Google DNS and Cloudflare DNS |
| TLS | PASS | Valid certificate installed; HTTPS validation and renewal dry-run passed |
| ImprovMX DNS | PASS | Both required MX records are present |
| Brevo DNS | PASS | Sending domain, verification, DKIM, DMARC, image and tracking records are present |
| Backups | PASS | Daily encrypted backup, checksum, lock and retention policy are active |
| Restore test | PASS | Isolated PostgreSQL and MinIO restore test passed and temporary resources were removed |

## Database Verification

- `db:check`: passed against the isolated SynCash Production database.
- Drizzle migrations: passed idempotently during the controlled releases without running a seed.
- Tables, indexes and constraints: passed.
- Notification database flow: passed with an ephemeral Production validation user and complete cleanup.
- Production users, clients and email outbox: empty after verification.
- `DATABASE_URL`: validated to target only the Compose PostgreSQL service.

## Runtime Verification

- Server-side DNS resolution through the system resolver, Google DNS (`8.8.8.8`) and Cloudflare DNS (`1.1.1.1`) returned only the Production server address.
- Plain HTTP returns a permanent `308` redirect to the equivalent HTTPS URL while preserving the ACME challenge path.
- Public HTTPS certificate validation passed without bypasses; the Hebrew maintenance page returns status 503 and public API routes remain unavailable.
- Certbot automatic renewal is enabled and active; the simulated renewal completed successfully.
- Full Hebrew PDF generation from the Production API image: passed.
- Masked Hebrew PDF generation from the Production API image: passed.
- Hebrew font embedding and extracted Unicode text: passed.
- ZIP generation and archive integrity: passed.
- MinIO temporary upload, download checksum and cleanup: passed.
- Encryption/decryption roundtrip with the active Production key, including a temporary encrypted database value and cleanup: passed.
- PostgreSQL, Redis, MinIO, Firebase Admin and Secret Manager runtime connections: passed.
- Authenticated live SSE connection through the running API: passed; the ephemeral Firebase and database user was removed.
- Notifications create, read and mark-as-read flow: passed; the temporary notification was removed.
- Frontend routes `/`, `/login`, `/register/advisor`, `/verify-email`, `/advisor`, `/admin` and lender invitation fallback: passed on loopback.
- API health, authenticated runtime services, temporary upload/download and private realtime flows passed while all public API routes remained behind maintenance mode.

## Security Verification

- Production environment permissions: owner-only.
- Google credential permissions: owner-only and outside the release tree.
- PostgreSQL, Redis and MinIO expose no host or Internet ports.
- API and Frontend use loopback host bindings only.
- UFW, Fail2ban, Nginx and Docker are active.
- Production images use restart policies and bounded JSON log rotation.
- Release and image scans found no Production environment secrets or private credential values.
- API log scanning found no encryption, authentication or secret errors and no configured sensitive values.
- Frontend image contains no Firebase Emulator, Mailpit, local development endpoint or E2E marker.
- API image contains no tests, source tree or environment files.
- Mailpit is not installed or running in Production.

## Email-Disabled Mode

- `EMAIL_DELIVERY_ENABLED=false` is active.
- Missing SMTP variables remain intentionally empty: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `EMAIL_REPLY_TO`.
- Email sending and financing-case delivery return a clear 503 service response before creating a submission or sending a message.
- Email verification does not create a failed email log when delivery is administratively disabled.
- The worker is not started, so pending email jobs cannot be consumed or marked as sent/failed.
- Public registration remains unavailable behind maintenance mode.

## Backups and Rollback

- Daily encrypted PostgreSQL, MinIO and Production configuration backup is scheduled through systemd.
- Daily retention is 14 days; weekly retention is 28 days.
- Checksums and exclusive locks are enforced.
- The restore test uses isolated temporary containers, network and volumes and removes them afterward.
- Release rollback preserves named volumes and does not reverse migrations automatically.

## Remaining Activation Gates

1. Configure the real Production SMTP provider and sender values; keep email delivery disabled until an authenticated send succeeds.
2. Verify actual inbound delivery to the support mailbox. DNS is ready, but mailbox receipt was not tested from this environment.
3. Enable email delivery and the worker only after SMTP verification succeeds.
4. Replace the maintenance Nginx site with the reviewed live proxy configuration, run `nginx -t`, and reload Nginx without restarting it.

The Production application is **not** marked complete, no email was sent, no seed or customer data was created, and maintenance mode remains enabled. The API is healthy but is not publicly reachable through Nginx.
