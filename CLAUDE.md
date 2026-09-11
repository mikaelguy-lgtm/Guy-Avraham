# SynCash — Claude Code Operating Rules

Read this before touching anything in this repository. Full detail lives in `docs/`:
`docs/PRODUCTION_HANDOFF.md`, `docs/BUSINESS_RULES.md`, `docs/SERVER_MAP.md`,
`docs/SECURITY_MODEL.md`, `docs/DECISIONS.md`, `docs/TODO.md`.

## What SynCash is

A secure financing workflow for Israeli mortgage advisors and non-bank lenders.
Advisors manage clients/documents and submit strictly anonymized cases to lender
companies, who decide and are then granted a time-boxed, OTP-gated portal to the
full case. Production: `https://app.syncash.co.il`.

## Non-negotiable safety rules

- PostgreSQL is the only source of truth for business data. Never add a JSON
  store, localStorage-as-authority, or a demo/fallback data path.
- Firebase proves identity only. Every authorization decision (role, advisor
  ownership, lender-company isolation) is re-checked server-side against
  PostgreSQL on every request. Never trust `advisorId`, `lenderId`, `role`, or
  any ownership field sent from the client.
- Never print, log, or write to docs/audit: SMTP passwords, Firebase private
  keys, `DATABASE_URL`, the field-encryption key, OTP codes, or portal/session
  tokens. Secrets live only in Google Secret Manager (name references are fine
  to write; values are not).
- No destructive DB operations (reset, seed, destructive migration) without a
  fresh backup, checksum, schema review, and an explicit go-ahead from the user.
- Before any Production migration that changes or deletes schema/data, capture
  row counts for at least: `users`, `clients`, `borrowers`, `documents`,
  `lenders`, `lender_contacts`, `company_submissions`, `case_versions`,
  `case_version_documents`, `email_outbox` — plus every table the migration
  touches directly or indirectly, even if not in that list. Compare counts
  after the migration and report any unexpected change. A table being
  intentionally dropped by the migration is not "unexpected" — an unplanned
  row-count change anywhere else is.
- No direct edits inside a running container. Every production change is
  Code → Test → Commit → immutable Release → Deploy.
- No merge to `main`, no force-push, no rebase of production history — ever —
  without the user's explicit, per-instance approval.
- Before any IAM / SSH / UFW / Fail2ban / Nginx-global / Docker-daemon / DNS /
  SSL-architecture change, or any destructive DB operation: stop and get
  explicit user approval. Regular SynCash code changes on an already-approved
  task do not need a second approval.
- Rollback changes the release/images only. It must never rewind or delete
  PostgreSQL, Redis, MinIO, volumes, or networks. Migration incompatibility is
  fixed forward, not by auto-running a DOWN migration.
- All timestamps are stored in UTC and rendered for users in `Asia/Jerusalem`
  (`he-IL` locale) through the shared formatters in `src/utils/formatters.ts`
  and `src/services/israelBusinessCalendar.ts`. Never hardcode a UTC+2/+3
  offset — always go through `Intl.DateTimeFormat` with an explicit time zone.

## Before starting any task

1. Read `CLAUDE.md` (this file).
2. Read `docs/PRODUCTION_HANDOFF.md`.
3. Read `docs/BUSINESS_RULES.md`.
4. Read `docs/DECISIONS.md`.
5. Read `docs/TODO.md` for open items and known discrepancies before
   re-discovering them from scratch.
6. Run `git status` and `git fetch --all --prune` before doing any work —
   do not assume local HEAD, GitHub, and the Production release match.
7. Do not assume Repository HEAD must equal the Production active release.
   A gap is only Config/Code Drift — and something to actually worry
   about — if the commits between Production and HEAD change runtime
   behavior. A HEAD that is ahead of Production by documentation-only
   commits (no `src/`, `drizzle/`, `Dockerfile*`, `docker-compose*`, or
   `scripts/*.sh` changes) is expected and does not require a deploy.
8. Before any future deploy, explicitly diff every commit between the
   current Production SHA and the target SHA and classify each one as
   runtime-affecting or documentation-only — don't assume the whole range
   needs deploying just because HEAD moved.
9. Any new release must be a descendant of the current Repository HEAD.
   Never build a release from a commit that drops or predates an existing
   documentation commit.
10. No merge to `main`, ever, without the user's explicit, per-instance
    approval (see the non-negotiable safety rules above).
11. Treat everything in root-level historical reports (`AUDIT.md`,
    `PRODUCTION_DEPLOYMENT_REPORT.md`, `FINAL_REPORT.md`, etc.) as a dated
    snapshot, not current truth. Code and live infrastructure state win
    over any document when they disagree — and the disagreement itself
    belongs in `docs/TODO.md` or `docs/DECISIONS.md`.

## Where things live (see docs/ for full detail)

- Production server: `169.58.83.2` (Ubuntu 24.04), deploy user `syncash`,
  app root `/opt/syncash`, Docker Compose project `syncash-prod`.
- 6 services: `frontend`, `api`, `worker`, `postgres`, `redis`, `minio`.
  Postgres/Redis/MinIO are never published to the internet.
- Active domain: `app.syncash.co.il`. The apex domain (`syncash.co.il` /
  `www.syncash.co.il`) still points at a legacy, unrelated server — never
  touch that DNS without an explicit instruction.
- SMTP is configured dynamically at runtime (Draft → Test → Activate →
  Rollback) through `email_configurations` in Postgres plus a Secret Manager
  reference — never through env vars/redeploy for a provider swap.

## Building a release artifact for deploy

Never build a Production release with a bare `git archive` from a Windows
machine — a local `core.autocrlf=true` setting once silently corrupted a
migration file to CRLF before it reached the server (see
`docs/DECISIONS.md`, 2026-08-29). Always use
`scripts/build-release-artifact.sh <git-sha> <output.tar.gz>`, which builds
directly from Git's object database and verifies every file against its
Git blob hash before producing the artifact. `deploy-production.sh` also
independently refuses to deploy a release containing a CRLF-corrupted
`.sh`/`.sql` file, regardless of how it was built — but don't rely on that
as your only check; build it right in the first place.

## Connecting to the production server

`ssh syncash-prod` (key-based, config at `C:\Users\guyav\.ssh\config`) is
**confirmed working** (live-verified 2026-08-29) and is the primary path. If
the key ever stops being accepted, a password fallback is scaffolded outside
this repo at `C:\Users\guyav\.syncash\` (`credentials.env` +
`connect-syncash.ps1`), also confirmed live via the server's effective SSH
config — per the user's explicit, standing approval for the development
period (see `docs/DECISIONS.md`). Never read, print, or copy the contents of
`credentials.env` into this repo, a commit, a log, or a chat response — use
the wrapper script, which reads it internally and never echoes the
password. This standing approval covers SSH login, read-only production
checks, logs, `docker ps`, health checks, and deploying an already-approved
task — it does **not** cover any of the sensitive operations listed above
(IAM/DNS/UFW/Fail2ban/root-SSH/Nginx-global/SSL/Docker-daemon/destructive-DB/
merge-to-main/force-push), which still need explicit per-instance approval
regardless of how access was obtained. Root SSH login remains fully blocked
server-side (`PermitRootLogin no`, `AllowUsers syncash`) — confirmed live.

## Ending a task

Run tests, commit only what was asked for, and leave the worktree in a state
you can explain — do not silently discard work you didn't create.
