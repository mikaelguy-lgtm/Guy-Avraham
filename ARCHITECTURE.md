# Architecture

## Runtime topology

```text
Browser (React/Vite)
  -> Firebase Authentication
  -> Express API with bearer token
       -> Firebase Admin token verification
       -> PostgreSQL/Drizzle user and role lookup
       -> Redis rate limits
       -> MinIO private document storage
       -> Mailpit/SMTP delivery
       -> Gemini backend-only analysis
```

Docker Compose defines `frontend`, `api`, `postgres`, `redis`, `minio`, and `mailpit`. PostgreSQL and Redis are available only on the internal backend network. MinIO and Mailpit expose development consoles; application traffic reaches PostgreSQL and Redis only through the API.

## Source layout

- `src/server/app.ts`: HTTP routes, validation, security middleware, workflow orchestration, and safe errors.
- `src/middleware/auth.ts`: Firebase verification, database user loading, active-user checks, role checks, advisor ownership, and lender-company isolation.
- `src/services/store.ts`: PostgreSQL data access through Drizzle.
- `src/db/schema.ts`: PostgreSQL tables and enums.
- `drizzle/`: generated migration and migration metadata.
- `src/services/storage.ts`: private S3-compatible storage.
- `src/services/email.ts`: SMTP verification and delivery.
- `src/services/snapshot.ts`: strict anonymous snapshot allowlist.
- `src/services/pdf.ts`: PDF generation from the anonymous snapshot only.
- `src/services/gemini.ts`: bounded, backend-only AI calls using anonymous financial context.
- `src/utils/crypto.ts`: AES-256-GCM field encryption and invite-token hashing.
- `src/components/`: authenticated advisor and lender UI.

## Data authority

PostgreSQL is the only persistent business-data source. Runtime, Drizzle Kit, migrations, seeds, and database checks all use `DATABASE_URL`. There is no JSON store, browser business-data store, or automatic demo fallback.

Documents are stored in a private S3-compatible bucket. PostgreSQL stores storage keys, MIME types, sizes, SHA-256 checksums, and lifecycle status. Downloads always re-check ownership or an approved identity disclosure.

## Authentication and authorization

Firebase proves identity. It does not supply application authorization. Every protected request loads the user, role, status, advisor profile, and lender membership from PostgreSQL. A user must exist, have `status = ACTIVE`, and have no deletion timestamp.

Stable roles are `SUPER_ADMIN`, `ADMIN`, `ADVISOR`, `LENDER_ADMIN`, and `LENDER_UNDERWRITER`. Display labels are stored separately. The frontend never supplies a trusted advisor ID, lender ID, role, permission set, creator ID, or responder ID.

## Submission lifecycle

1. An advisor-owned client is loaded from PostgreSQL.
2. A strict financial allowlist produces `anonymousSnapshot`.
3. The anonymous PDF is generated only from that snapshot.
4. A submission is created as `PENDING_DELIVERY`.
5. A 32-byte random invitation token is generated; only its SHA-256 hash is stored.
6. SMTP success marks the submission `SENT`; failure marks it `DELIVERY_FAILED`.
7. Public validation returns only lender name and an authentication requirement.
8. After Firebase login, lender membership must match the submission lender.
9. Subsequent access is based on the authenticated user and lender membership, not URL query identifiers.

## Identity disclosure

Lenders can request only allowlisted fields. The advisor can approve a strict subset and specific document IDs. The API returns only approved fields and blocks every unapproved document. Every request and decision is audited.

