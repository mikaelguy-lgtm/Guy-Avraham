# SynCash Production Deployment Report

Report date: 2026-07-28

Target: `app.syncash.co.il`

Branch: `codex-syncash-production-rebuild`

Deployed release: `5c21d6ae6fa7259bd3c74aa6eaba45325a8fb87b`

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
| Secret Manager access | PASS | Encryption, Firebase and SMTP secrets are readable; the runtime identity can add versions only to the SMTP secret while broader secret-management permissions remain denied |
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
- Release `790129f376db0d965f49367b614ba2da3256787a` is deployed with migration `0010`; the new email configuration table exists and currently contains no active configuration.
- The runtime Service Account has Secret Accessor and Secret Version Adder on `syncash-smtp-password` only. Secret metadata access and version-disable permissions remain denied.
- SMTP settings now use a PostgreSQL-backed Draft/Test/Activate lifecycle with an immutable Secret Manager version reference.
- API and Worker resolve the active configuration dynamically for every delivery cycle; activation and rollback require no restart or environment change.
- Failed drafts do not replace or disable the active configuration.
- Gmail and Brevo presets enforce STARTTLS on port 587; custom SMTP supports explicit no-encryption, STARTTLS and direct TLS modes.
- SUPER_ADMIN-only RBAC, rate limiting, SSRF protection, audit events and sanitized request IDs cover every configuration action.
- The Production SUPER_ADMIN screen rendered successfully after deployment. Gmail and Brevo presets, custom editable transport controls, password masking and disabled Test/Activate actions before a valid tested draft were verified without entering or exposing a credential.
- All six Production containers remained healthy after the controlled deployment; HTTPS health, login and direct SMTP settings routes passed. Email delivery, registration and external portals remain disabled.

### Gmail draft save incident

- The visible request identifier ending in `f12c4be-354a-4448-b67d-a3cc30d03048` matched the audited Production request `1f12c4be-354a-4448-b67d-a3cc30d03048` on `PATCH /api/admin/settings/email`.
- Secret Manager successfully created a new secret version and PostgreSQL successfully stored the Gmail draft and audit event, but Google returned the version resource with the numeric Project identifier. The response-time verification accepted only the textual Project identifier, threw `INVALID_SECRET_VERSION`, and the sanitized global handler returned HTTP `500` with `INTERNAL_SERVER_ERROR`.
- Release `5c21d6ae6fa7259bd3c74aa6eaba45325a8fb87b` canonicalizes trusted version resources to the configured Project, safely handles legacy numeric references, and no longer converts a successful secret write into a failed browser response.
- The two affected draft references were normalized in PostgreSQL without reading or changing secret values. Both references validate and the existing draft now reports that its SMTP password is configured.
- Gmail App Password input removes ordinary spaces only and requires 16 remaining characters. A failed save keeps the password field populated for retry on the same page; a successful save clears it.
- The Production screen now presents an explicit Draft, Tested and Active progress bar with numbered actions, visible lock states, explanatory text and responsive layouts for mobile, tablet and desktop.
- No SMTP test or activation was performed during this repair. Email delivery remains disabled and no email-dependent public flow was enabled.

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

The restricted SUPER_ADMIN-only state described above was the pre-opening state and was superseded by the controlled public opening recorded below.

## Controlled Public Opening — 2026-07-29

- The active Gmail configuration remains `ACTIVE` and is resolved dynamically by both the API and Worker.
- Email delivery, public advisor registration and external portals are enabled in the API and Production frontend; SUPER_ADMIN-only mode is disabled.
- Release `b70cb2a1145f428e7a4cb285e92ed4061f63a39e` was deployed after an encrypted pre-deployment backup, migration check and complete service health check.
- Public registration reached the authenticated registration handler instead of the disabled gate. External review and access routes reached their token validation handlers instead of the disabled gate.
- A controlled temporary advisor registration completed with one verification email accepted by the active SMTP provider and one `SENT` verification email log.
- Firebase email verification state, advisor activation, initial login, logout-equivalent token disposal and a fresh login all passed.
- The temporary advisor created a complete client case and uploaded all five required PDF document types.
- The Worker delivered the lender invitation, interest OTP, full-access notification, lender decision notification, advisor notification and portal OTP.
- Interest OTP verification, full-access creation, portal OTP verification, portal case access and portal logout passed.
- Notification records included both the case-sent and company-interested events.
- Every controlled outbox message was `SENT` with exactly one attempt and a distinct sanitized message identifier; matching `email_logs` records existed and no duplicate delivery or unnecessary retry was found.
- Direct Production SPA refresh checks passed for login, registration, verification, advisor and both external portal route families.
- All temporary Firebase, PostgreSQL and MinIO test data was removed. The post-cleanup smoke marker count is zero.
- API and Worker log scans found zero unhandled, internal-server, secret, authentication or delivery-job error markers during the controlled opening window.
- HTTPS health is passing and all six Production containers are healthy.

## Pilot Remediation - 2026-08-01

### Numeric validation and database integrity

- All client creation and editing count fields reject signs, decimals and scientific notation; monetary values accept zero and reject negatives or malformed input.
- Frontend field validation, API/domain validation and PostgreSQL `CHECK` constraints now cover borrowers, children, income, liabilities, property and loan amounts, documents, offers, analysis metrics, SMTP port, case versions, invitations, OTP and outbox attempts.
- The read-only Production audit completed before migration and found no existing negative values in the affected fields. No Production data was modified or deleted by the audit.
- Direct API submissions cannot bypass the validation rules and return a sanitized field-level `400` response for invalid values.

### Married borrower behavior

- Selecting a married relationship hides both marital-status selectors, derives the second borrower address from the first borrower and keeps it synchronized.
- The server independently canonicalizes married borrower marital status and address, so manual API requests cannot bypass the rule.
- Changing away from married restores user-entered values where available and clears only automatically derived values. Existing cases remain readable and editable.
- Hebrew PDF and lender snapshot generation continue to use the canonical borrower data.

### Lender email investigation and delivery status

- The two original lender invitations were traced through assignment, case version, outbox, Worker and `email_logs` without exposing recipient or client data.
- Both original messages were accepted by the active SMTP server exactly once, each with one attempt and a sanitized message identifier. They were later confirmed in the recipients' Spam folders.
- Root cause: downstream mailbox filtering after SMTP acceptance, not missing queue creation, Worker failure or SMTP rejection.
- No automatic resend was performed for either original message.
- Case and administration screens distinguish queued, SMTP accepted, failed and opened/responded states. They do not label SMTP acceptance as delivery.
- Manual resend is allowed only for a failed message with no earlier successful SMTP acceptance, requires confirmation and uses an idempotency key.

### Email guidance and abuse prevention

- Registration verification, OTP, lender portal and administration flows display the partially masked recipient and advise checking Spam, Junk and Promotions folders.
- Resend controls enforce a 60-second cooldown, visible countdown and bounded attempt limits. Deterministic idempotency prevents duplicate queue records.
- Success copy states that the message was sent to the mail server unless a real downstream delivery signal exists; failed SMTP operations produce a visible sanitized failure.
- Every operational email record exposes only masked recipient, creation time, attempt time, SMTP status, attempt count, resend state, safe failure reason and request ID to authorized Admin users.
- HTML messages remain simple and include a matching plain-text part; OTP values, active verification links and credentials are not written to logs or administration responses.

### Israel time handling

- Database timestamps remain UTC instants. Application display uses one centralized formatter with locale `he-IL` and time zone `Asia/Jerusalem`.
- User-facing timestamps use `DD/MM/YYYY HH:mm` across client, document, email, notification, audit, PDF, portal and administration views where those timestamps are presented.
- Cooldowns, OTP expiry and link expiry continue to compare absolute instants rather than local-time strings.
- Tests cover Israel standard time, daylight-saving time, both DST transitions and UTC dates that display on the following calendar day in Israel.
- `email_logs` and audit timestamps are stored in UTC and rendered in Israel time.

### Local verification

- `npm ci`: passed.
- Typecheck and lint: passed.
- Unit tests: 120 passed.
- Integration tests: 108 passed.
- Playwright E2E: 19 passed, including 390, 768 and 1440 pixel layouts.
- Production build and bundle safety scan: passed.
- Drizzle migration check: passed.
- Local Docker stack: all seven development services healthy.
- Dependency audit retains advisories in upstream React Router RSC functionality and Firebase Admin transitive dependencies. SynCash is a BrowserRouter SPA and does not use React Server Components; forced dependency downgrades were rejected because they introduced more high-severity advisories.

### Controlled Production deployment

- Release `4f93feff706a79dc53d734768a60938897b9fe10` was deployed through the controlled release script.
- The first deployment attempt stopped before build or migration after the encrypted backup completed because MinIO staging files were owned by a container user. The cleanup now uses the existing restricted `sudo` deployment permission, and the verified staging directory was removed without touching backup archives or application data.
- The successful attempt created and checksum-verified an encrypted pre-deployment backup, validated the Google Secret Manager provider, applied migration `0011`, rebuilt the API and frontend and completed the Production healthcheck.
- All 11 new database constraints exist. A post-migration read-only audit found zero invalid negative records.
- Production retained 3 client records and 18 document records across the deployment. No seed, reset, cleanup or test-data insertion ran against Production.
- The two latest original lender invitation jobs remain `SENT`, each with exactly one attempt and a message identifier; both have matching `email_logs` entries. No failed-message resend record was created.
- HTTPS and direct SPA refresh checks passed for `/`, `/login`, `/register/advisor`, `/verify-email`, `/advisor`, `/admin` and `/admin/email-logs`.
- A real Chromium smoke check at 390, 768 and 1440 pixel widths rendered the login, registration, verification and protected-route login shell with zero console errors.
- Unauthenticated client and Admin email-log API calls return `401`; the health endpoint returns `200`.
- API and Worker logs contain zero unhandled, internal-server, authentication, encryption, secret-provider or failed-job error markers in the deployment window.
- PostgreSQL, Redis, MinIO, API, Frontend and Worker are healthy. Public registration and the external portals remain in their previously approved Production state.

## Israel Greeting and Brevo Final Verification - 2026-08-01

### Israel-time dashboard greeting

- Root cause: the advisor dashboard rendered a hard-coded morning greeting and did not calculate the current business time zone.
- Release `5029f52db4f55e5b6c0ac4bfa3aea15f650210c1` introduced one centralized `Asia/Jerusalem` greeting utility and a lifecycle hook used by Advisor, Admin, SUPER_ADMIN and Lender dashboards.
- The greeting refreshes on initial render, at the next minute boundary, when the tab becomes visible and when the window regains focus.
- Boundary tests passed for `04:59`, `05:00`, `11:59`, `12:00`, `17:59`, `18:00`, `21:54`, `22:59` and `23:00`; `21:54` resolves to `ערב טוב`.
- Tests also passed across Israel daylight-saving and standard time while the browser was configured to a non-Israel time zone.

### Controlled Brevo deliveries

- API and Worker resolved the active Brevo configuration dynamically. The active transport uses the approved Brevo relay, port `587`, STARTTLS, `notifications@syncash.co.il` as From and `support@syncash.co.il` as Reply-To.
- Exactly two controlled real messages were sent: one advisor email-verification message and one lender case invitation.
- Both messages created a single sanitized `email_logs` record with a message identifier. The lender outbox completed with status `SENT`, one attempt, no retry and no duplicate row.
- Brevo recorded `Sent` and `Delivered` events for both messages. Gmail received both in the primary Inbox rather than Spam, and subsequent `First opening`/`Opened` events were visible.
- The advisor verification link completed successfully through Firebase. The lender review link resolved successfully and returned only the masked case view.
- A real Production OTP was intentionally not requested because it would have created a third email, contradicting the explicit two-message limit. The OTP and full portal flow remain covered by the passing local full-flow Playwright test.

### Masked snapshot remediation

- Controlled portal validation found that an unstructured home address without a comma could be treated as a residence city and copied into the masked snapshot.
- Release `f122d440b162bc4882b4e67d53814abc4b2255ba` now extracts a residence city only from a clearly delimited, city-like final segment and applies a second defensive redaction before persisting a masked snapshot.
- A regression test proves that a full address without a delimiter is never exposed and that numeric postal-code suffixes are rejected.
- The temporary Production snapshot was sanitized and its masked PDF regenerated before the invitation link was used. Follow-up portal validation found no identity number, phone, email, employer, home address or exact property address.

### Verification and cleanup

- Typecheck and lint: passed.
- Unit tests: 131 passed.
- Integration tests: 108 passed.
- Playwright E2E: 20 passed.
- Production build and bundle safety scan: passed.
- PostgreSQL, Redis, MinIO, API, Frontend and Worker are healthy; API health returns `ok` and API/Worker error-marker counts are zero.
- The temporary Firebase advisor, PostgreSQL user/profile, client, company/contact, delivery records, notifications, audits, email logs, outbox rows, documents and MinIO objects were removed after verification. Post-cleanup marker counts are zero.
- Public registration, email delivery and external portals remain enabled in their previously approved state. No SMTP credential, active link, token or secret value was written to this report.
