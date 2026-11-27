# Contabo Deployment Plan

This file is documentation only. No deployment, DNS update, domain connection, or production data operation is authorized by this repository change.

## Proposed topology

- Ubuntu LTS host with Docker Engine and Compose v2.
- Reverse proxy terminating TLS and routing the public web and API hosts.
- PostgreSQL and Redis remain on an internal Docker network with no host ports.
- MinIO uses durable encrypted storage and is not publicly browsable.
- SMTP uses an approved production relay.
- Secrets are injected by the host or Google Secret Manager, never copied into images or Git.

## Pre-deployment checklist

1. Create encrypted off-host backups and test a restore.
2. Set unique PostgreSQL, MinIO, SMTP, Firebase, and encryption credentials.
3. Set exact HTTPS values for `APP_URL`, `API_URL`, and `ALLOWED_ORIGINS`.
4. Build immutable frontend and API images from an approved commit.
5. Run `npm ci`, audit, typecheck, lint, unit tests, integration tests, Playwright, and build.
6. Run migrations against a staging database and verify schema state.
7. Verify bucket privacy, signed-download expiry, SMTP delivery, and Firebase token validation.
8. Configure health checks, log retention, disk monitoring, certificate renewal, and backup alerts.
9. Perform a synthetic advisor/lender workflow with no customer data.
10. Obtain explicit production deployment approval.

## Rollback

Keep the previous immutable images and a migration-aware rollback plan. Database rollback must be designed per migration; do not run destructive down migrations automatically. Restore from a verified backup when a forward fix cannot preserve integrity.

