# SynCash Production Deployment Report

Report date: 2026-07-27

Target: `app.syncash.co.il` on `169.58.83.2`

Branch: `codex-syncash-production-rebuild`

Status: **Firebase Production connected; public startup remains blocked by SMTP and DNS gates**

Prepared release candidate: `3af97244c172`

## Completed

- Audited the new dedicated Ubuntu 24.04 server before changes.
- Confirmed no existing applications, containers, databases, volumes, custom Nginx sites, or certificates were present.
- Created and separately verified the `syncash` deployment user before hardening SSH.
- Installed Docker Engine, Compose, Nginx, Certbot, UFW, Fail2ban, ShellCheck, and backup prerequisites without a general OS upgrade or reboot.
- Enabled 4 GiB swap, Asia/Jerusalem timezone, UFW rules for SSH/HTTP/HTTPS, Fail2ban, and key-only SSH for `syncash`.
- Prepared isolated Compose project `syncash-prod`, networks, volumes, loopback ports, SHA-tagged images, resource limits, health checks, security options, and log rotation.
- Split API and delivery jobs into separate Production processes while preserving the development on-demand behavior.
- Prepared PostgreSQL migration, encrypted backup, isolated restore-test, health, rollback, Nginx, and systemd timer scripts.
- Validated the Production Compose model on the target server and passed ShellCheck for deployment scripts.
- Built `syncash-api:3af97244c172` and `syncash-frontend:3af97244c172` on the target server from an exact `git archive` of the tested commit.
- Verified the API image contains the compiled API, worker, and migration artifacts.
- Verified the frontend image starts read-only, returns a healthy response, and contains no prohibited development/private markers.
- Installed and reloaded the isolated Nginx HTTP server block after `nginx -t` passed. It currently returns 502 by design because Production containers are not started before the external configuration gate.
- Installed the dedicated Firebase Production service-account credential outside the release tree with owner-only permissions.
- Configured Application Default Credentials, the Production Firebase project, the Firebase client identity, and the authoritative Firebase Web App configuration in the protected server environment.
- Kept the Firebase Emulator disabled and removed the legacy emulator/credential-path variables from the Production environment.
- Updated the API and worker runtime identity so the non-root processes can read the owner-only credential without weakening file permissions.

## Verification Results

- `npm ci`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run test:unit`: 97/97 passed.
- `npm run test:integration`: 86/86 passed.
- `npm run test:e2e`: 19/19 passed in a real Chromium browser.
- `npm run build`: passed; the repository Production bundle safety scan passed.
- `docker compose config --quiet`: passed on the target server using non-secret placeholders.
- `shellcheck`: passed for every Production shell script.
- Google Application Default Credentials: passed against the Production project.
- Google Secret Manager read-only access: passed for the field-encryption and Firebase-key secrets; no secret value was retained or emitted.
- Firebase Admin SDK initialization and Firebase Authentication access: passed.
- Firebase ID token mint, verification, and immediate temporary-user cleanup: passed.
- Firebase Email/Password provider and the required authorized domain: passed.
- Firebase Web App configuration: passed against the authoritative Production project configuration.
- Firebase Emulator exclusion: passed.
- `npm run db:check`: cannot run from the Windows host because the local development URL uses the Docker-internal hostname `postgres` and the Docker Desktop CLI/WSL integration is unavailable. The Production check remains gated behind creation of the real isolated PostgreSQL service.
- `npm audit --omit=dev`: reports 13 transitive advisories. The remaining chains are upstream in Google/Firebase libraries plus a React Router RSC advisory; this application is a Vite SPA and does not enable React Server Components. No unsafe major override, forced downgrade, or `npm audit fix --force` was applied.

## Isolation

- Compose project: `syncash-prod`.
- Networks: `syncash-prod-internal`, `syncash-prod-edge`.
- Volumes: `syncash-prod-postgres-data`, `syncash-prod-redis-data`, `syncash-prod-minio-data`.
- Frontend/API host targets: `127.0.0.1:3180`, `127.0.0.1:3181`.
- PostgreSQL, Redis, MinIO API, and MinIO Console are not published to the host or Internet.
- Mailpit, Firebase Emulator, Vite, Playwright, and test containers are excluded.

## Current External Blockers

- DNS: `app.syncash.co.il` does not yet resolve to `169.58.83.2`.
- Real Production SMTP host/user/password/sender/reply-to and mail-domain records are not available.
- Compatible upstream releases eliminating the remaining npm transitive advisories are not currently available; this risk must be accepted or resolved before the opening gate.

No development credential, emulator, Mailpit endpoint, fabricated secret, or Production customer data was used. No application containers, migrations, SSL issuance, Production email, or public opening were attempted while these blockers remain.

Docker long-running service status: no SynCash Production containers started. Final API and frontend images are built and ready; PostgreSQL, Redis, MinIO, API, worker, and frontend remain intentionally stopped.

## DNS Action

Create only this record:

- Type: A
- Host: `app`
- Value: `169.58.83.2`
- TTL: 300 or provider default

The existing `syncash.co.il` and `www.syncash.co.il` records remain untouched.

## Rollback

The release rollback switches only SynCash images and the `/opt/syncash/current` symlink. It preserves named volumes and does not reverse migrations automatically. Server baseline files are stored under `/opt/syncash/backups/pre-deploy-*`.

## Declaration

No non-SynCash application, container, volume, network, domain, database, or configuration file was deleted, stopped, modified, or overwritten. The server was new and dedicated; only SynCash-specific files and baseline security services were added.
