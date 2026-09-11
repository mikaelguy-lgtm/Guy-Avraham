# SynCash Production Deployment

## Layout

- Root: `/opt/syncash`
- Releases: `/opt/syncash/releases/<git-sha>`
- Active release: `/opt/syncash/current`
- Environment: `/opt/syncash/shared/env/.env.production` (`0600`, owner `syncash`)
- Google ADC credential: `/opt/syncash/shared/secrets/google-application-credentials.json` (`0600`, owner `syncash`)
- Backups: `/opt/syncash/backups`
- Logs and locks: `/opt/syncash/shared/logs`, `/opt/syncash/shared/locks`

## External Prerequisites

1. Create an A record for `app.syncash.co.il` pointing to `169.58.83.2`.
2. Provide Firebase Production public web configuration and add `app.syncash.co.il` as an authorized domain.
3. Provide a Firebase Admin service-account identity and its private key through Google Secret Manager.
4. Provide a Google ADC credential file authorized to access only the required SynCash secrets.
5. Create Google Secret Manager values named `syncash-field-encryption-key`, `syncash-firebase-private-key`, and `syncash-smtp-password`.
6. Provide real SMTP host, port, user, sender address, and reply-to address. Mailpit and development SMTP credentials are forbidden.
7. Configure SPF, DKIM, and DMARC through the selected mail provider. Do not replace existing MX records without a separate mail migration.

## Release Upload

Create the release from the tested commit, excluding `.git`, dependencies, build output, test output, all `.env` files, local secrets, and customer data. Upload it as the `syncash` user to `/opt/syncash/releases/<git-sha>` and normalize shell scripts to LF with executable mode.

Run:

```bash
cd /opt/syncash/releases/<git-sha>
./scripts/deploy-production.sh <git-sha>
```

The deploy script validates non-secret configuration names, rejects emulator/development URLs, validates Compose, creates an encrypted pre-deploy backup, builds SHA-tagged images, starts private infrastructure, verifies Google Secret Manager, runs migrations once, starts API/worker/frontend, verifies health, and atomically updates `current`.

## Nginx and TLS

Install only the SynCash server block and validate before reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

After DNS resolves to this host:

```bash
sudo certbot --nginx -d app.syncash.co.il
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

## Rollback

```bash
/opt/syncash/current/scripts/rollback-production.sh
```

Rollback changes only the SynCash release/images and never deletes or rewinds PostgreSQL, Redis, MinIO, networks, or volumes. A migration incompatibility requires a reviewed forward fix.

## Backups and Restore Test

Daily backups are encrypted with GPG, checksummed, retained for at least 14 days, and copied weekly with at least 4 weekly generations. The timer runs as `syncash` and uses a lock.

```bash
/opt/syncash/current/scripts/backup-production.sh --daily
/opt/syncash/current/scripts/restore-production.sh --test /opt/syncash/backups/daily/<backup>.tar.gz.gpg
```

The automated restore command creates isolated temporary Docker containers, network, and volumes and removes only resources prefixed `syncash-restore-test-`. Production restore is intentionally manual and requires a reviewed recovery plan.

An encrypted off-server backup destination is still required for disaster recovery.
