# SynCash — Server Map

Compiled 2026-08-28 from repo documentation, **live-verified over SSH on
2026-08-29** (see `docs/PRODUCTION_HANDOFF.md` sections 4 and 6 for the full
live-check log). Sections below are marked accordingly. No IPs beyond the
already-public production address are included; no credentials appear here.

## Directories

```
/opt/syncash
├── current                          -> symlink to active release
├── releases/<git-sha>/              one directory per deployed release
├── shared/
│   ├── env/.env.production          0600, owner syncash
│   ├── secrets/google-application-credentials.json   0600, owner syncash
│   ├── logs/
│   └── locks/
└── backups/
    ├── daily/    (live-confirmed 2026-08-29: 4 archives present, one per
    │              day for the last 4 days, ~5.7MB each + .sha256 checksum,
    │              mode 600, owner syncash)
    └── weekly/   (live-confirmed 2026-08-29: 4 weekly generations present)
```

## Docker

- Compose project: `syncash-prod` (file: `compose.production.yml`).
- Networks: `syncash-prod-internal` (internal, no external routing),
  `syncash-prod-edge`.
- Volumes: `syncash-prod-postgres-data`, `syncash-prod-redis-data`,
  `syncash-prod-minio-data`.
- Services (6 long-running + 1 one-shot tool):

| Service | Image / build | Ports | Notes |
| --- | --- | --- | --- |
| `postgres` | `postgres:17-alpine` | none published | 4g mem / 2.0 cpu limit |
| `redis` | `redis:7.4-alpine`, `--appendonly yes`, password-protected | none published | 1g mem / 0.75 cpu limit |
| `minio` | `quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z` | none published | 4g mem / 2.0 cpu limit |
| `api` | built from `Dockerfile.production` target `api` | `127.0.0.1:3181:3000` | read-only rootfs, non-root user, tmpfs `/tmp` |
| `worker` | same image as `api` | none | heartbeat-file healthcheck (90s staleness) |
| `frontend` | built from `Dockerfile.production` target `frontend` | `127.0.0.1:3180:8080` | Nginx-served static bundle, read-only rootfs |
| `migrate` | same image as `api`, `profiles: ["tools"]` | none | one-shot: `node dist-server/src/db/migrate.js` |

All node services run with `security_opt: no-new-privileges:true`,
`init: true`, JSON-file logging capped at 20MB × 5 files, and a non-root
`SYNCASH_RUNTIME_UID:GID`. `GOOGLE_APPLICATION_CREDENTIALS` is mounted
read-only from the host path into the container at the same path.

## Ports (documented, per `DEPLOYMENT_PORTS.md`)

| Port | Bind | Component | Exposure |
| --- | --- | --- | --- |
| 22/tcp | `0.0.0.0`/`[::]` | OpenSSH | Public, key-only, `syncash` user only |
| 80/tcp | `0.0.0.0`/`[::]` | Nginx | Public HTTP + ACME challenge, 308-redirects to HTTPS |
| 443/tcp | `0.0.0.0`/`[::]` | Nginx | Public HTTPS |
| 3180/tcp | `127.0.0.1` | frontend container | Nginx reverse-proxy target only |
| 3181/tcp | `127.0.0.1` | api container | Nginx reverse-proxy target only |
| 5432/6379/9000/9001 | Docker-internal only | postgres/redis/minio | **Live-confirmed 2026-08-29**: `docker ps` filtered on these ports returns nothing — not published to host or internet |

Mailpit, Firebase Emulator, Vite, and Playwright ports must never appear in
Production — their presence would itself be a finding. Not specifically
re-scanned this pass beyond the DB/cache/storage port check above.

## Nginx / TLS — live-confirmed 2026-08-29

- `sudo nginx -t` → syntax OK, config test successful.
- Certificate `app.syncash.co.il` (ECDSA), **valid, expires 2026-10-26**
  (58 days out at audit time), managed by `certbot.timer` (next run
  2026-08-29 16:55 IDT).
- Server block path not re-confirmed this pass (documented as
  `/etc/nginx/sites-available/app.syncash.co.il.conf`).

## Firewall / SSH — live-confirmed 2026-08-29

- UFW / Fail2ban: not re-checked this pass (no destructive/state-changing
  risk either way, just not on the list this time — see `docs/TODO.md`).
- Effective `sshd -T`: `PermitRootLogin no`, `AllowUsers syncash`.
- `PasswordAuthentication` is `no` globally but overridden to `yes`
  specifically for `syncash` via a `Match User syncash` block in
  `/etc/ssh/sshd_config.d/99-syncash-password.conf` — confirmed via
  `sshd -T -C user=syncash`. This is intentional (user-approved, dev-period
  password fallback) and was already in place, not created in this pass.
  See `docs/SECURITY_MODEL.md` and `docs/DECISIONS.md`.
- Several other files under `/etc/ssh/sshd_config.d/` set conflicting
  global `PasswordAuthentication` values (`50-cloud-init.conf`: yes,
  `60-cloudimg-settings.conf`: no, `99-temp.conf`: yes, unscoped) — today's
  effective config is correct regardless (confirmed live), but this is
  worth tidying up eventually; see `docs/TODO.md`.

## Timers / backups — live-confirmed 2026-08-29

- `syncash-backup.timer`: last ran 2026-08-29 02:26 IDT, next run
  2026-08-30 02:29 IDT.
- `/opt/syncash/backups/pre-deploy/`: a separate backup taken automatically
  by `deploy-production.sh` (via `backup-production.sh --pre-deploy`) at the
  start of every deploy, in addition to the daily/weekly timer-driven ones.
- `syncash-health.timer`: runs roughly every 5 minutes.
- `certbot.timer`: next run 2026-08-29 16:55 IDT.
- Restore-test resources are always prefixed `syncash-restore-test-` and are
  torn down automatically; production restore itself is manual-only by
  design — not exercised this pass.

## DNS

| Host | Target | Notes |
| --- | --- | --- |
| `app.syncash.co.il` | `169.58.83.2` | Active production app |
| `syncash.co.il` | `62.219.78.222` (legacy) | Do not change without explicit instruction |
| `www.syncash.co.il` | `62.219.78.222` (legacy) | Do not change without explicit instruction |
| `send.syncash.co.il` | Brevo-managed | Branded sending subdomain for DKIM/tracking |

## Re-verification checklist (read-only, run periodically)

```bash
readlink -f /opt/syncash/current
docker ps
docker compose -p syncash-prod ls
docker compose -p syncash-prod ps
sudo nginx -t
sudo certbot certificates
systemctl list-timers
df -h
free -h
```
