# Security

## Controls

- Firebase Admin verifies bearer tokens and checks revocation.
- PostgreSQL supplies active status, role, advisor ownership, and lender membership.
- AES-256-GCM encrypts sensitive fields with a random 96-bit IV and authentication tag.
- Encryption keys are loaded through `SecretProvider`; encryption code never reads `process.env` directly.
- Invite tokens use `crypto.randomBytes(32)` and only SHA-256 hashes are persisted.
- Helmet, a strict CORS allowlist, request IDs, body limits, upload limits, safe errors, and Redis-backed rate limits protect the API.
- Multipart uploads require an allowed MIME type and matching magic bytes, receive a random storage key, and store a SHA-256 checksum.
- The anonymous snapshot and PDF are generated from a fixed allowlist and never from a full client object.
- SMTP passwords are never returned or written to PostgreSQL. APIs return only `passwordConfigured`.
- Audit metadata must contain identifiers and action context only; passwords, tokens, secrets, authorization headers, and full PII are prohibited.

## Role boundaries

- `SUPER_ADMIN`: system settings, SMTP, users, database/security status, and sensitive audit access.
- `ADMIN`: general business administration only; no SMTP secret, database, encryption, or sensitive audit access.
- `ADVISOR`: only clients assigned to the advisor, their documents, submissions, disclosure decisions, and offers.
- `LENDER_ADMIN` / `LENDER_UNDERWRITER`: only submissions belonging to their lender company.

Changing an ID in a URL does not broaden access. Ownership checks run on the server before data loading or mutation.

## Secrets

`.env` is ignored. `.env.example` contains names and non-sensitive examples only. Production requires Firebase credentials and a 32-byte base64 field-encryption key. Google Secret Manager failures do not fall back silently to another source, and secret writes do not mutate `process.env`. Local Docker runtime secret updates use AES-256-GCM storage in a named Docker volume with a master key supplied only through ignored local environment configuration; this provider is rejected in production.

Rotate a compromised encryption key only through a planned re-encryption migration. Replacing it directly makes existing ciphertext unreadable.

## Dependency audit

The final local audit has zero high and zero critical findings. Ten moderate advisories remain in development/cloud transitive dependencies, primarily Drizzle Kit's legacy esbuild loader and Firebase Admin Google Cloud transitive packages. They are not ignored: review `npm audit` during every dependency update and upgrade when upstream packages publish compatible fixes.

## Reporting

Do not include customer data, tokens, secrets, or full request bodies in a vulnerability report. Include the request ID, affected endpoint, expected authorization boundary, observed status, and a minimal synthetic reproduction.
