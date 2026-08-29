# SynCash — Production Handoff

Compiled: 2026-08-28, from a read-only audit of the local repository and
existing root-level reports. **Server-side items marked BLOCKED could not be
independently verified** — SSH access from this machine to the production
host was not working at audit time (see "Access blocker" below). Everything
else was verified against the actual local source code, not just prior docs.

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
| Active release | `/opt/syncash/current` (symlink) |
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

## 3. Deploy / rollback / backup (process as documented; state below is live-verified)

Deploy: upload a tested commit's release to
`/opt/syncash/releases/<git-sha>`, then run
`./scripts/deploy-production.sh <git-sha>` as `syncash`. The script validates
config, rejects dev/emulator URLs, validates Compose, takes an encrypted
pre-deploy backup, builds SHA-tagged images, starts infra, verifies Secret
Manager, runs migrations exactly once, starts API/worker/frontend, health
checks, then atomically flips `current`.

Rollback: `/opt/syncash/current/scripts/rollback-production.sh` — changes
only the release/images, never touches PostgreSQL/Redis/MinIO/volumes.
Migration incompatibility requires a reviewed forward fix, not an automatic
down-migration.

Backups (live-confirmed 2026-08-29): `syncash-backup.timer` — last ran
2026-08-29 02:26 IDT, next run 2026-08-30 02:29 IDT. `/opt/syncash/backups/daily/`
holds one GPG-encrypted archive + `.sha256` checksum per day for the last 4
days (Aug 25–28, all tagged with the current release SHA
`9e87b8922c109250e2bda12722a2a6efd142aa16`, ~5.7MB each, mode `600` owned by
`syncash`). `/opt/syncash/backups/weekly/` holds 4 weekly generations
(Aug 2, 9, 16, 23). Restore test script creates isolated
`syncash-restore-test-*` resources and tears them down; production restore
is intentionally manual — not exercised in this pass.

Scripts present in the repo (`scripts/`): `deploy-production.sh`,
`rollback-production.sh`, `backup-production.sh`, `restore-production.sh`,
`migrate-production.sh`, `healthcheck-production.sh`,
`install-production-timers.sh`, `production-common.sh`.

## 4. Operational state — live-verified 2026-08-29, 11:4x IDT

Confirmed directly over SSH (`syncash-prod`, key auth), all read-only:

| Check | Result |
| --- | --- |
| Active release (`readlink -f /opt/syncash/current`) | `/opt/syncash/releases/9e87b8922c109250e2bda12722a2a6efd142aa16` |
| Containers (`docker ps`) | All 6 healthy, up ~15h: `frontend`, `worker`, `api` (image tag `9e87b8922c1...`), `postgres:17-alpine`, `redis:7.4-alpine`, `minio` |
| API health (`curl 127.0.0.1:3181/api/health`) | `200 {"status":"ok"}` |
| Published DB/cache/object-storage ports | None — `docker ps` filtered on 5432/6379/9000 returns empty, confirming Postgres/Redis/MinIO are not internet- or even host-reachable outside the Docker network |
| Nginx | `nginx -t` → syntax OK, config test successful |
| TLS (Certbot) | `app.syncash.co.il`, ECDSA, valid, **expires 2026-10-26 (58 days out)** |
| Disk | `/` — 290G total, 13G used, 277G free (5%) |
| Memory | 23Gi total, ~1.1Gi used, 22Gi free; swap 4Gi, 0 used |
| Load average | 0.09, 0.12, 0.09 (idle) |
| API/Worker error logs (last 24h) | Worker: zero error markers. API: **one burst of 3× `UNHANDLED_REQUEST_ERROR` at 2026-08-29 06:52:40 UTC (09:52:40 IDT)**, `requestId: undefined` on all three, all within 19ms of each other, nothing before or since in the 24h window — see `docs/TODO.md`, not investigated further in this pass |
| `docker compose -p syncash-prod ls` | Reports config files from **two** release directories (current `9e87b89...` and an older `b1cb13b...`) rather than only the current one — likely benign compose-project bookkeeping, not confirmed as a problem, noted in `docs/TODO.md` |

This matches the release the repo's own `PRODUCTION_DEPLOYMENT_REPORT.md`
(2026-08-01, "Single-OTP Lender Portal Verification") describes as the last
verified deployment — i.e. **nothing has been deployed since that report was
written**, which is consistent with local HEAD (`d2af618`) being a
docs-only commit with no corresponding release directory on the server.

Not independently re-probed this pass (would require credentials or a
write-risk action the user asked to avoid): SMTP send test, direct Secret
Manager/Firebase Admin calls. Inferred healthy from: API/worker health
checks passing (both depend on Secret Manager + Firebase Admin succeeding
at startup) and zero secret/auth/encryption error markers in 24h of logs.

## 5. Git / release drift found during this audit

- Local `codex-syncash-production-rebuild` HEAD (`d2af618`) is **3 commits
  ahead of `origin/codex-syncash-production-rebuild`** (`fa7607a`): `c3ad17f`,
  `9e87b89`, `d2af618`.
- The repo's own deployment report says releases `c3ad17f` and `9e87b89`
  were **already deployed to Production** — meaning Production is currently
  running code that does not exist on GitHub. GitHub is not a reliable
  source of truth for "what's live" right now.
- `d2af618` ("Document single-OTP lender portal verification") is
  documentation-only and was **not** deployed — confirmed live 2026-08-29:
  `/opt/syncash/releases/` has no directory for it, and the active release
  is still `9e87b8922c109250e2bda12722a2a6efd142aa16` (i.e. `9e87b89`).
- The working tree is **not clean**: 31 tracked files modified (schema,
  validation, app.ts, store.ts, several components, most test suites) plus 2
  untracked Drizzle migration files (`drizzle/0013_violet_goblin_queen.sql`,
  `drizzle/meta/0013_snapshot.json`). This is live, in-progress work — see
  `docs/TODO.md` for what it implements and what's still wrong in it. Do not
  discard it.
- A second local branch exists, `codex-local-production-rebuild` (`c01e0e3`,
  "Fix advisor email verification and password guidance") — not investigated
  further in this pass; flagged only so it isn't mistaken for stray junk.

## 6. Production server SSH access — resolved 2026-08-29

A dedicated ED25519 key (`~/.ssh/syncash_prod`, `Host syncash-prod` in
`~/.ssh/config`) was installed to `/home/syncash/.ssh/authorized_keys` and
confirmed working: `ssh syncash-prod whoami` → `syncash`. This is now the
primary access path and was used for every live check in section 4.

A password fallback also exists for the development period, per the user's
explicit, standing instruction (see `docs/DECISIONS.md`): local secret file
`C:\Users\guyav\.syncash\credentials.env` (outside any repo, Windows ACLs
restricted to the current user) plus a wrapper script
`C:\Users\guyav\.syncash\connect-syncash.ps1` that tries the key first and
only reads the password internally (never via argv/history) if the key
fails. **No Claude session should ever read or print the contents of
`credentials.env`.**

Live-confirmed effective SSH config (`sudo sshd -T` / `sudo sshd -T -C
user=syncash,...`):

- `PermitRootLogin no` — confirmed for both the global and the syncash-user
  context.
- `AllowUsers syncash` — root cannot even attempt to authenticate.
- Global default `PasswordAuthentication no`, but a scoped
  `Match User syncash` block in `/etc/ssh/sshd_config.d/99-syncash-password.conf`
  overrides it to `yes` for `syncash` specifically — the only user allowed
  to log in at all. Net effect: `syncash` has both key and password auth;
  root has neither. This matches the user's requirement exactly and was
  **not modified in this pass** — it was already in place.
- Minor hygiene note (not touched, not urgent): `/etc/ssh/sshd_config.d/`
  contains several overlapping/redundant `PasswordAuthentication` lines
  across `00-syncash-hardening.conf` (no), `50-cloud-init.conf` (yes),
  `60-cloudimg-settings.conf` (no), and a global (non-scoped)
  `99-temp.conf` (yes) in addition to the correct scoped
  `99-syncash-password.conf`. Today's *effective* result is correct and
  verified live, but the redundancy is confusing for the next person who
  reads these files — see `docs/TODO.md`.

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

## 7. Requirement audit (section 33 of the handoff brief)

See `docs/BUSINESS_RULES.md` for the full pass/fail table and
`docs/TODO.md` for what remains open. Summary: additional-income is now a
proper dynamic array (implemented), rent was added as a liability type
(implemented), "מוסד תורני" was added as an employment type (implemented),
"בעל שליטה" now displays as "שכיר בעל שליטה" (implemented) — but the marital
status "SEPARATED" and employment types "GOVERNMENT_EMPLOYEE"/
"SECURITY_FORCES" were only demoted to legacy-only (not deleted), and the new
"financial institution" liability field is currently wired to the wrong
liability types (LOAN/MORTGAGE instead of the requested ALIMONY/RENT). None
of this in-progress work has been committed, migrated, or deployed.
