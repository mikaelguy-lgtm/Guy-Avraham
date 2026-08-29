# SynCash — Production Handoff

Compiled 2026-08-28, updated through the 2026-08-29 Production deployment of
`0af63f4` (migrations `0014` and `0015` applied — the SynCash product
rebuild: server-determined lender targeting, credit indication,
self-employed income, address split, offer-feature removal, forbidden-
wording ban, full lender portal/PDF/typography rebuild). This supersedes
the earlier same-day `3f5685e` deploy (migration `0013`, CRLF
release-artifact hardening), whose section below is kept for its incident
history but no longer reflects the live active release. Everything below
reflects live-verified state as of the `0af63f4` deployment unless marked
otherwise.

## 1. Architecture

```
Browser (React 19 / Vite, BrowserRouter SPA)
  -> Firebase Authentication (identity only)
  -> Express 5 API, bearer token
       -> Firebase Admin token verification (src/middleware/auth.ts)
       -> PostgreSQL / Drizzle user + role + ownership lookup (src/services/store.ts)
       -> Redis-backed rate limits
       -> MinIO (S3-compatible) private document storage (src/services/storage.ts)
       -> SMTP delivery, dynamic provider (src/services/email.ts)
       -> Gemini backend-only analysis, anonymous context only (src/services/gemini.ts)
  -> Worker (email outbox, retries, reminders, expirations, OTP/session cleanup)
```

Key source files (confirmed by direct code read, not just docs):

| File | Role |
| --- | --- |
| `src/server/app.ts` | All HTTP routes, request validation, workflow orchestration, safe error responses. Also enforces legacy-value rules (`assertLegacySelectionsUnchanged`). |
| `src/middleware/auth.ts` | Firebase verification, DB user load, active-user check, role checks, `requireAdvisorClientAccess`, `requireLenderSubmissionAccess`. |
| `src/services/store.ts` | All Postgres/Drizzle reads and writes. |
| `src/db/schema.ts` | Tables, enums, and `CHECK` constraints — the actual data-model source of truth. |
| `src/services/storage.ts` | MinIO/S3 client: bucket init, put/get/signed URL/delete. |
| `src/services/email.ts` | SMTP transport resolution + sending via `nodemailer`. |
| `src/services/snapshot.ts` | Builds the fully-anonymized snapshot sent to lenders. |
| `src/services/pdf.ts` | PDF generation with a custom RTL/Hebrew text reorderer (`bidi-js`). |
| `src/services/gemini.ts` | Bounded backend-only AI analysis call. |
| `src/services/israelBusinessCalendar.ts` | All Israeli business-day / deadline / DST-safe date math. |
| `src/utils/crypto.ts` | AES-256-GCM field encryption, token hashing (HMAC-SHA256 if `TOKEN_HASH_SECRET` set, else SHA-256), constant-time compare. |
| `src/utils/formatters.ts` | Currency/date/enum-label formatting, Israel-time greeting, `ISRAEL_TIME_ZONE`. |
| `src/utils/apiClient.ts` | Frontend fetch client — three variants: Firebase-authenticated, external-portal (cookie+CSRF), and public. |

Roles (confirmed identical in `src/db/schema.ts:19` and `src/domain/types.ts:1`):
`SUPER_ADMIN`, `ADMIN`, `ADVISOR`, `LENDER_ADMIN`, `LENDER_UNDERWRITER`.
Note: `src/types.ts` (frontend) redeclares the same union independently rather
than importing it — not a bug, just a duplication to be aware of.

Data authority: PostgreSQL only. No JSON store, no localStorage-as-authority,
no demo fallback — confirmed in code, not just in `ARCHITECTURE.md`.

## 2. Production topology

| Item | Value |
| --- | --- |
| Server | `169.58.83.2`, Ubuntu 24.04 LTS, ~8 vCPU / ~24 GB RAM / ~300 GB SSD |
| Deploy/runtime user | `syncash` (never `root` for normal operations) |
| App root | `/opt/syncash` |
| Releases | `/opt/syncash/releases/<git-sha>` |
| Active release | `/opt/syncash/current` (symlink) → `8bf3d2020d7d2addbccbb91677e0c52ab3bce36f` |
| Env file | `/opt/syncash/shared/env/.env.production` (`0600`, owner `syncash`) |
| Google ADC credential | `/opt/syncash/shared/secrets/google-application-credentials.json` (`0600`) |
| Backups | `/opt/syncash/backups` |
| Logs / locks | `/opt/syncash/shared/logs`, `/opt/syncash/shared/locks` |
| Docker Compose project | `syncash-prod` (`compose.production.yml`) |
| Domain | `app.syncash.co.il` → `169.58.83.2`, HTTPS via Certbot |

Apex domain warning: `syncash.co.il` and `www.syncash.co.il` still point at a
different, legacy server (`62.219.78.222`, per `SERVER_AUDIT_SYNCASH.md`,
2026-07-27). Do not touch that DNS without an explicit instruction — it's
unrelated to `app.syncash.co.il` except that Brevo's outbound-mail domain
authentication (DKIM/DMARC/branded subdomain) lives on the apex domain.

### Docker services (6, per `compose.production.yml`)

`frontend`, `api`, `worker`, `postgres`, `redis`, `minio`. A 7th "service"
(`migrate`) exists only as a one-shot `profiles: ["tools"]` job, not a
long-running container. Postgres/Redis/MinIO have no host port mappings —
API and frontend are bound to `127.0.0.1` only and reached through Nginx.

### External providers

- **Firebase**: project `syncash-production`, runtime service account
  `syncash-prod-runtime@syncash-production.iam.gserviceaccount.com`.
- **Google Secret Manager**: `syncash-field-encryption-key` (32 random bytes,
  base64), `syncash-firebase-private-key`, `syncash-smtp-password`. Runtime
  identity has version-access on all three, plus version-add on the SMTP
  secret only (needed for the dynamic Draft/Test/Activate SMTP flow).
- **SMTP**: Brevo (`smtp-relay.brevo.com:587`, STARTTLS), From
  `notifications@syncash.co.il`, Reply-To `support@syncash.co.il`. Gmail was
  used transiently during pilot and is kept only as historical rollback —
  do not delete that config without instruction. Mailpit is dev-only, never
  production.
- **ImprovMX**: MX forwarding for `admin@`, `notifications@`, `support@` →
  Gmail.
- **Brevo DNS**: sending-domain verification, DKIM, DMARC, branded
  `send.syncash.co.il` subdomain, image/link redirect — all reported present
  as of the last verification (`PRODUCTION_DEPLOYMENT_REPORT.md`, 2026-08-01).

## 3. Deploy / rollback / backup

Deploy: build a release artifact for the exact tested commit with
`scripts/build-release-artifact.sh <git-sha> <output.tar.gz>` (produces a
byte-for-byte copy of the Git tree via `git archive` plus a `git hash-object`
verification of every file against its Git blob — see section 8 for why this
exists), upload it to `/opt/syncash/releases/<git-sha>`, then run
`cd` into that directory and `./scripts/deploy-production.sh <git-sha>` as
`syncash`. The script now also asserts no shell script or SQL migration in
the release contains a CRLF byte before doing anything else, then validates
config, rejects dev/emulator URLs, validates Compose, takes an encrypted
pre-deploy backup, builds SHA-tagged images, starts infra, verifies Secret
Manager, runs migrations exactly once, starts API/worker/frontend, health
checks, then atomically flips `current`.

Rollback: `/opt/syncash/current/scripts/rollback-production.sh` — changes
only the release/images, never touches PostgreSQL/Redis/MinIO/volumes.
Migration incompatibility requires a reviewed forward fix, not an automatic
down-migration. Not required as of the `3f5685e` deploy.

Backups (live-confirmed 2026-08-29, before and after the `3f5685e` deploy):
`syncash-backup.timer` runs daily; a manual `--pre-deploy` backup is also
taken automatically by `deploy-production.sh` on every deploy.
`/opt/syncash/backups/daily/` and `/opt/syncash/backups/pre-deploy/` hold
GPG-encrypted archives with matching `.sha256` checksums, mode `600`, owned
by `syncash`. Restore test script creates isolated `syncash-restore-test-*`
resources and tears them down; production restore is intentionally manual —
not exercised.

Scripts present in the repo (`scripts/`): `build-release-artifact.sh` (new,
2026-08-29), `deploy-production.sh`, `rollback-production.sh`,
`backup-production.sh`, `restore-production.sh`, `migrate-production.sh`,
`healthcheck-production.sh`, `install-production-timers.sh`,
`production-common.sh`.

## 4. Operational state — live-verified 2026-08-29 (post `8bf3d20` deploy)

| Check | Result |
| --- | --- |
| Active release (`readlink -f /opt/syncash/current`) | `/opt/syncash/releases/8bf3d2020d7d2addbccbb91677e0c52ab3bce36f` |
| Containers (`docker ps`) | All 6 healthy: `frontend`, `worker`, `api` (image tag `8bf3d20...`), `postgres:17-alpine`, `redis:7.4-alpine`, `minio` |
| Public site (`https://app.syncash.co.il`) | `200` externally; served CSS/JS bundle hashes match this build (`index-CvxT9jA6.css`) |
| Migrations | No new migration beyond `0015` — `migrate-production.sh` ran as a no-op (UI/content-only release) |
| API/Worker error logs (post-deploy) | Zero error markers in either |
| Backup | Pre-deploy encrypted backup taken automatically by `deploy-production.sh` before this release |
| Scope of this release | UI/CSS/content only (credit indication redesign, company-response timestamps, borrower-labeled document names, removal of the "שליחת גרסה חדשה" button, larger `.eyebrow`/status-badge/meta type). No schema change, no data migration |
| Rollback required | No |

## 5. Git / release state — in sync as of 2026-08-29

Production active release: `8bf3d2020d7d2addbccbb91677e0c52ab3bce36f`.
Local HEAD and `origin/codex-syncash-production-rebuild`: same SHA
(`8bf3d2020d7d2addbccbb91677e0c52ab3bce36f`) — fully in sync as of this deploy.
Prior release `0af63f40d9f56fa70c7c9dd90fd9217dfa27c39e` remains on disk at
`/opt/syncash/releases/0af63f40d9f56fa70c7c9dd90fd9217dfa27c39e` for rollback
if needed. See the "Before starting any task"
checklist in `CLAUDE.md` for how to reason about a HEAD/Production gap in
future sessions; always confirm the exact current HEAD with `git log`
rather than trusting this SHA prefix if it's been a while. (The prior
same-day deploy at `3f5685e318f2d06ac2e247635e40602904d80e95` is
superseded — see its history below, still accurate as a historical record
of that specific deploy.)

History: this commit bundled 31 previously-uncommitted files plus migration
`0013` (dynamic additional incomes, RENT liability type, legacy-safe
marital-status/employment handling), was pushed in one commit to
`origin/codex-syncash-production-rebuild` (fast-forward, no force), then
deployed. See `docs/DECISIONS.md` for what changed and why.

A second local branch, `codex-local-production-rebuild` (`c01e0e3`), still
exists and has not been investigated — see `docs/TODO.md`.

## 6. Production server SSH access

Primary: a dedicated ED25519 key (`~/.ssh/syncash_prod`, `Host syncash-prod`
in `~/.ssh/config`) installed to `/home/syncash/.ssh/authorized_keys`,
confirmed working (`ssh syncash-prod whoami` → `syncash`).

Fallback (dev-period only, user-approved — see `docs/DECISIONS.md`): a local
secret file `C:\Users\guyav\.syncash\credentials.env` (outside any repo,
Windows ACLs restricted to the current user) plus a wrapper script
`C:\Users\guyav\.syncash\connect-syncash.ps1` that tries the key first and
only reads the password internally (never via argv/history) if the key
fails. **No Claude session should ever read or print the contents of
`credentials.env`.**

Live-confirmed effective SSH config:

- `PermitRootLogin no`, `AllowUsers syncash` — root cannot authenticate at all.
- Global default `PasswordAuthentication no`, overridden to `yes` specifically
  for `syncash` via a `Match User syncash` block in
  `/etc/ssh/sshd_config.d/99-syncash-password.conf`. Net effect: `syncash` has
  both key and password auth; root has neither. Matches the user's
  requirement exactly; not modified by any Claude session.
- Minor hygiene note (not touched, not urgent): several overlapping/redundant
  `PasswordAuthentication` lines exist across other files in
  `/etc/ssh/sshd_config.d/` — see `docs/TODO.md`.

Re-run periodically (all read-only, no state change):

```bash
readlink -f /opt/syncash/current
docker ps
docker compose -p syncash-prod ls
sudo nginx -t
systemctl list-timers | grep -i syncash
df -h; free -h
sudo sshd -T -C user=syncash | grep -iE 'passwordauthentication|permitrootlogin'
```

## 7. Requirement audit (section 33 of the original handoff brief)

See `docs/BUSINESS_RULES.md` for the full pass/fail table. Summary, all now
live in Production: additional income is a dynamic array; RENT was added as a
liability type; "מוסד תורני" was added as an employment type; "בעל שליטה" now
displays as "שכיר בעל שליטה"; "גוף פיננסי" (financial institution) correctly
shows only for LOAN/MORTGAGE and stays null for ALIMONY/RENT, confirmed
correct after an earlier audit-record error was caught and fixed; a raw API
`PATCH` cannot leave a stale institution/balance behind a liability-type
change (tested). Marital status "SEPARATED" and employment types
"GOVERNMENT_EMPLOYEE"/"SECURITY_FORCES" remain legacy-only rather than fully
deleted — open question for the user, see `docs/TODO.md`.

## 8. Release-artifact integrity (CRLF hardening, 2026-08-29)

**Incident**: building the `3f5685e` release artifact on a Windows machine
with global `core.autocrlf=true` silently converted every non-`.sh` tracked
text file (including the `0013` SQL migration) to CRLF during `git archive`
— a byte-different artifact from what was tested, caught only by manual
checksum comparison before it reached Production.

**Root-cause fix**: `.gitattributes` now explicitly declares `eol=lf` for
`*.sh .sql .ts .tsx .js .mjs .cjs .json .yml .yaml .md .conf` and
`Dockerfile*`, plus a `* text=auto eol=lf` fallback. This makes `git archive`
/ `git checkout` always emit LF for these types regardless of the building
machine's `core.autocrlf`/`core.eol` settings — verified with
`git archive --worktree-attributes`, and confirmed to trigger zero file
reformatting (blobs were already stored as LF; this only changes future
checkout/archive behavior).

**Defense in depth**:
- `scripts/build-release-artifact.sh` (new) builds the archive with
  `-c core.autocrlf=false -c core.eol=lf` as a second, independent layer,
  then verifies **every** tracked file's extracted content against its exact
  Git blob hash using `git hash-object --no-filters` (the `--no-filters` flag
  is essential — without it, `git hash-object` silently re-applies the clean
  filter and would mask exactly this class of corruption). Refuses to
  produce the artifact on any mismatch.
- `scripts/production-common.sh` gained `assert_no_crlf_in_release()`, a
  git-independent invariant check (scans for literal CRLF in any `.sh`/`.sql`
  file via `file`, not a fragile shell-escape-dependent grep pattern — an
  earlier `grep -Il $'\r'` implementation was tried and found to behave
  inconsistently depending on invocation context during testing).
  `deploy-production.sh` now calls this **before any other work**, so any
  future deploy — regardless of how the release directory was produced —
  fails immediately rather than reaching build/migrate/Production.
- Covered by `tests/unit/releaseArtifactIntegrity.test.ts` (5 tests): the
  guard correctly passes clean releases, fails and names CRLF-corrupted
  `.sh`/`.sql` files, ignores unrelated file types, and the build script
  correctly verifies a real `HEAD` build.

This fix is tooling/documentation only — no application code changed, no
Production deploy was required to land it (it travels automatically with
whatever release is built next, since `deploy-production.sh` is itself part
of each release's own file tree).
