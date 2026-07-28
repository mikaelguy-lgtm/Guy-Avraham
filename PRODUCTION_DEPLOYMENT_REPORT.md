# SynCash Production Deployment Report

Report date: 2026-07-28

Target: `app.syncash.co.il`

Branch: `codex-syncash-production-rebuild`

Prepared release: `48233d9dba6d`

Status: **Infrastructure, the private application runtime and the maintenance site are active; public activation remains blocked by Brevo SMTP account activation.**

## Production State

| Component | Status | Notes |
| --- | --- | --- |
| PostgreSQL | PASS | Healthy, migrated, private network only, dedicated volume, no seed data |
| Redis | PASS | Healthy, authenticated, private network only, dedicated volume |
| MinIO | PASS | Healthy, private network only, dedicated volume and application bucket initialized |
| API | PASS | Healthy on loopback only; private runtime verification passed and public Nginx access remains blocked |
| Frontend | PASS | Healthy on loopback only; direct SPA routes passed |
| Worker | PASS | Healthy with email delivery enabled; the empty queue has no retries or errors |
| Firebase | PASS | ADC, Admin SDK, Email/Password, ID-token verification and authorized domain passed |
| Secret Manager access | PASS | Encryption, Firebase and SMTP secrets are readable with the configured runtime identity |
| Encryption secret format | PASS | A new version of the existing secret is canonical Base64 and decodes to exactly 32 bytes |
| Nginx | PASS | Configuration test and reload passed |
| Maintenance mode | PASS | HTTP redirects permanently to HTTPS; HTTPS and all public API routes return the Hebrew maintenance page with status 503 |
| DNS | PASS | The application host resolves to the Production server through the server resolver, Google DNS and Cloudflare DNS |
| TLS | PASS | Valid certificate installed; HTTPS validation and renewal dry-run passed |
| ImprovMX DNS | PASS | Both required MX records are present |
| Brevo DNS | PASS | Sending domain, verification, DKIM, DMARC, image and tracking records are present |
| Brevo SMTP | BLOCKED | STARTTLS and SMTP authentication pass, but Brevo rejects message data because SMTP sending is not activated for the account |
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
- The replaced SMTP key was removed from Brevo; the exposed Secret Manager version is disabled and only the rotated version is active.
- The SMTP password is not stored in the environment file, release tree, image or Git history.

## SMTP Activation State

- The approved Brevo relay host, STARTTLS port, SMTP user, sender address, sender name and reply-to address are configured.
- `EMAIL_DELIVERY_ENABLED=true` is active and the Worker is healthy.
- The runtime Service Account can read the rotated SMTP secret from Google Secret Manager.
- Nodemailer `verify()` passes through STARTTLS on port 587.
- Brevo rejects `DATA` with a provider account-activation response, so no test message was accepted or delivered.
- No `PRODUCTION_SMTP_TEST` email log was created and no duplicate or retry was generated.
- The Worker queue is empty and Worker logs contain no SMTP, secret or authentication errors.
- Public registration remains unavailable behind maintenance mode.

## Backups and Rollback

- Daily encrypted PostgreSQL, MinIO and Production configuration backup is scheduled through systemd.
- Daily retention is 14 days; weekly retention is 28 days.
- Checksums and exclusive locks are enforced.
- The restore test uses isolated temporary containers, network and volumes and removes them afterward.
- Release rollback preserves named volumes and does not reverse migrations automatically.

## Remaining Activation Gates

1. Request and receive Brevo SMTP account activation; credentials, sender and domain authentication are already configured.
2. Repeat the exact Production test email and verify Brevo delivery, ImprovMX receipt and SPF/DKIM/DMARC headers.
3. Complete registration verification, OTP, lender invitation, notification queue and Worker retry delivery checks, then clean their temporary data.
4. Replace the maintenance Nginx site with the reviewed live proxy configuration only after all activation gates pass, run `nginx -t`, and reload Nginx without restarting it.

The Production application is **not** marked complete, Brevo accepted no email, no seed or customer data was created, and maintenance mode remains enabled. The API and Worker are healthy but the API is not publicly reachable through Nginx.
