# Local Development

## Requirements

- Node.js 24
- npm 11
- Docker Desktop with Compose v2
- Docker-managed Firebase Authentication emulator for interactive login

## Environment

Copy `.env.example` to `.env`. Set `POSTGRES_PASSWORD` and use the same value in `DATABASE_URL`. Set unique MinIO credentials. Generate `FIELD_ENCRYPTION_KEY` locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Never commit `.env`. Production startup rejects missing Firebase credentials, a missing/invalid encryption key, or wildcard CORS.

For Docker development, set `SECRET_PROVIDER=local-encrypted`, `LOCAL_SECRET_STORE_PATH=/var/lib/syncash-secrets/secrets.bin`, and a random 32-byte base64 `LOCAL_SECRET_MASTER_KEY`. Docker stores the encrypted secret file in the `local_secrets` named volume outside the repository. Production rejects this provider and must use the configured production provider, normally Google Secret Manager.

## Start and initialize

```bash
docker compose up -d
docker compose exec api npm run db:migrate
docker compose exec api npm run db:check
docker compose exec api npm run db:seed
docker compose ps
```

The seed contains synthetic profiles only. It creates matching users in PostgreSQL and the local Firebase Authentication emulator. Set all `E2E_*_EMAIL` and `E2E_*_PASSWORD` values in `.env` before seeding; running the seed again updates the local credentials idempotently.

## Development services

- Mailpit UI: `http://localhost:8025`. Submission emails and secure invitation links appear here.
- MinIO console: `http://localhost:9001`. Use the credentials configured in `.env`.
- Firebase Authentication emulator: `http://localhost:9099`. It is local-only and requires no external Firebase credentials.
- SMTP settings and test delivery are available only to `SUPER_ADMIN`. Mailpit uses `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_SECURE=false`, and an empty `SMTP_USER`.
- PostgreSQL and Redis do not expose host ports.
- The API and frontend use hot reload through mounted source directories.

## Database lifecycle

```bash
npm run db:generate
docker compose exec api npm run db:migrate
docker compose exec api npm run db:check
docker compose exec api npm run db:seed
```

A new database is initialized exclusively by migrations. Do not use schema push as a production substitute.

## Tests

Unit and Supertest integration tests use isolated in-memory adapters and synthetic identities. They never read real secrets or customer data.

```bash
npm run test:unit
npm run test:integration
```

The real Playwright scenario requires the Docker stack, seeded Firebase users, and these environment variables:

```text
E2E_BASE_URL=http://localhost:5173
E2E_ADVISOR_EMAIL=
E2E_ADVISOR_PASSWORD=
E2E_LENDER_EMAIL=
E2E_LENDER_PASSWORD=
E2E_OTHER_LENDER_EMAIL=
E2E_OTHER_LENDER_PASSWORD=
```

Run it with `npm run test:e2e`. The test must not be replaced with an echo or mocked browser result.

## Gmail SMTP

Use `smtp.gmail.com` on port `587` with `SMTP_SECURE=false`; SynCash requires STARTTLS for this combination. Set `SMTP_USER` and `EMAIL_FROM` to the Gmail address. Enter a Google App Password in `SMTP_PASSWORD`, never the normal account password.
