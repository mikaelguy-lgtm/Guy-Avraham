# SynCash Production Deployment Report

Report date: 2026-07-28

Target: `app.syncash.co.il`

Branch: `codex-syncash-production-rebuild`

Prepared release: `616bd048be211d5641318f724d98e5a53f4d776a`

Status: **The application is available over HTTPS in controlled SUPER_ADMIN-only mode. Public registration, external portals and all email delivery remain disabled until SMTP activation is completed.**

## Production State

| Component | Status | Notes |
| --- | --- | --- |
| PostgreSQL | PASS | Healthy, migrated, private network only, dedicated volume, no seed data |
| Redis | PASS | Healthy, authenticated, private network only, dedicated volume |
| MinIO | PASS | Healthy, private network only, dedicated volume and application bucket initialized |
| API | PASS | Healthy on loopback behind Nginx; authenticated SUPER_ADMIN access and public safety gates passed |
| Frontend | PASS | Healthy on loopback behind Nginx; login, dashboard, settings and direct SPA routes passed |
| Worker | PASS | Healthy for non-email work; email jobs are suspended and the empty queue has no retries or errors |
| Firebase | PASS | ADC, Admin SDK, Email/Password, ID-token verification and authorized domain passed |
| Secret Manager access | PASS | Encryption, Firebase and SMTP secrets are readable with the configured runtime identity |
| Encryption secret format | PASS | A new version of the existing secret is canonical Base64 and decodes to exactly 32 bytes |
| Nginx | PASS | Configuration test and reload passed |
| Maintenance mode | OFF | Removed after `nginx -t`; HTTPS exposes only the controlled login flow and existing SUPER_ADMIN access |
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
- Production contains one active SUPER_ADMIN synchronized with Firebase; clients and email outbox remain empty.
- `DATABASE_URL`: validated to target only the Compose PostgreSQL service.

## Runtime Verification

- Server-side DNS resolution through the system resolver, Google DNS (`8.8.8.8`) and Cloudflare DNS (`1.1.1.1`) returned only the Production server address.
- Plain HTTP returns a permanent `308` redirect to the equivalent HTTPS URL while preserving the ACME challenge path.
- Public HTTPS certificate validation passed without bypasses; Nginx serves the application and preserves the permanent HTTP-to-HTTPS redirect.
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
- Direct refreshes for `/`, `/login`, `/register/advisor`, `/verify-email`, `/advisor`, `/admin`, `/admin/settings`, `/admin/settings/smtp` and lender invitation fallback return the SPA successfully.
- Real-browser verification passed for SUPER_ADMIN login, dashboard, system settings, SMTP settings, save without a new password, navigation, session preservation, refresh and logout.
- The disabled-email Hebrew notice is visible after login. Browser console and network verification found no unexpected errors.

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
- SMTP settings are restricted to SUPER_ADMIN in both frontend and backend. The password is never returned to the browser, and a blank password field does not replace the stored secret.
- Saving non-secret SMTP settings without a password produced an `SMTP_UPDATED` audit record with `passwordUpdated=false`; no password or secret key exists in `system_settings`.
- `SUPER_ADMIN_ONLY_MODE=true`, public registration is disabled, and external review, lender invitation, OTP and public verification flows are blocked.

## SMTP Activation State

- The approved Brevo relay host, STARTTLS port, SMTP user, sender address, sender name and reply-to address are configured.
- `EMAIL_DELIVERY_ENABLED=false` is active and the Worker is healthy for non-email tasks.
- The runtime Service Account can read the rotated SMTP secret from Google Secret Manager.
- Email delivery is not attempted automatically. The outbox contains zero records, zero attempts and zero sent messages.
- The existing SMTP secret remains unchanged. Manual SMTP testing remains available only to SUPER_ADMIN for the future controlled activation step.
- Worker and API logs contain no runtime errors, SMTP retries, secret exposure or authentication failures.
- Public registration and external portals remain disabled independently of Nginx maintenance mode.

## Dynamic SMTP Upgrade

- The request identified in the UI as `4081…` was traced to missing runtime permission for adding a new Secret Manager version; the API previously returned a generic sanitized `500`.
- SMTP settings now use a PostgreSQL-backed Draft/Test/Activate lifecycle with an immutable Secret Manager version reference.
- API and Worker resolve the active configuration dynamically for every delivery cycle; activation and rollback require no restart or environment change.
- Failed drafts do not replace or disable the active configuration.
- Gmail and Brevo presets enforce STARTTLS on port 587; custom SMTP supports explicit no-encryption, STARTTLS and direct TLS modes.
- SUPER_ADMIN-only RBAC, rate limiting, SSRF protection, audit events and sanitized request IDs cover every configuration action.

## Backups and Rollback

- Daily encrypted PostgreSQL, MinIO and Production configuration backup is scheduled through systemd.
- Daily retention is 14 days; weekly retention is 28 days.
- Checksums and exclusive locks are enforced.
- The restore test uses isolated temporary containers, network and volumes and removes them afterward.
- Release rollback preserves named volumes and does not reverse migrations automatically.

## Remaining Activation Gates

1. Activate an approved SMTP provider configuration through the SUPER_ADMIN email settings screen and complete a successful manual test email.
2. Enable email delivery only after delivery, receipt and SPF/DKIM/DMARC verification pass.
3. Complete registration verification, OTP, lender invitation, notification queue and Worker retry delivery checks, then clean their temporary data.
4. Review and explicitly enable public registration and external portals only after their email-dependent flows pass.

The Production application is available only for the existing SUPER_ADMIN. No seed, demo or customer data was created; email delivery, public registration and external portals remain disabled. All six containers are healthy and the HTTPS application is reachable through Nginx.
