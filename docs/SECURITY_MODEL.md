# SynCash — Security Model

Compiled 2026-08-28 from direct source reads (`src/middleware/auth.ts`,
`src/utils/crypto.ts`, `src/services/email.ts`, `src/db/schema.ts`) plus
`SECURITY.md` and `ARCHITECTURE.md`.

## Authentication vs. authorization

Firebase proves **identity only**. Authorization is decided **exclusively**
server-side against PostgreSQL, on every protected request:

1. `requireFirebaseAuth` — verifies the bearer ID token via Firebase Admin
   (revocation-checked).
2. `loadDatabaseUser` — loads the corresponding PostgreSQL user row.
3. `requireActiveUser` — the user must exist, have `status = ACTIVE`, and no
   deletion timestamp.
4. `requireRole(...)` — role gate.
5. `requireAdvisorClientAccess` — the target client's `advisorId` must match
   the authenticated advisor, or the caller is `SUPER_ADMIN`.
6. `requireLenderSubmissionAccess` — the target submission's `lenderId` must
   match the authenticated lender user's company.

(All in `src/middleware/auth.ts`.) The frontend never supplies a trusted
`advisorId`, `lenderId`, `role`, permission set, `creatorId`, or
`responderId` — every such value sent by the client is either ignored or
re-derived server-side. Changing an ID in a URL does not broaden access.

## Roles

`SUPER_ADMIN` (system settings, SMTP, users, DB/security status, sensitive
audit) > `ADMIN` (general administration, no secrets/DB/encryption access) >
`ADVISOR` (own clients only) / `LENDER_ADMIN`, `LENDER_UNDERWRITER` (own
lender company's submissions only).

## Encryption

- `src/utils/crypto.ts`: AES-256-GCM, versioned envelope
  `v1:iv:tag:ciphertext` (base64), random 96-bit IV per encryption, requires
  an exact 32-byte key. The key is loaded exclusively through
  `SecretProvider` — encryption code never reads `process.env` directly.
- Token hashing: `crypto.randomBytes(32)` for invite/OTP/portal-session
  tokens; only the SHA-256 (or HMAC-SHA256 if `TOKEN_HASH_SECRET` is set)
  hash is ever persisted. Comparison uses `timingSafeEqual`
  (`tokenHashesEqual`) to avoid timing attacks.
- Sensitive PII fields (addresses, employer names, financial-institution
  names, etc.) are stored as `*_encrypted` columns, decrypted only at the
  point of authorized display.

## Secret Manager

Three secrets: `syncash-field-encryption-key`, `syncash-firebase-private-key`,
`syncash-smtp-password`. The runtime service account has version-access on
all three, and version-add on the SMTP secret only (required for the dynamic
SMTP Draft/Test/Activate lifecycle — see `SMTP_DYNAMIC_CONFIGURATION.md`).
It does **not** have secret-listing, version-listing, secret-deletion, or
project-wide secret-admin permissions. Do not request broader IAM without
explicit user approval — this is a hardened, least-privilege setup.

Secret values are never returned to the browser, never logged, and never
written to audit metadata. A blank password field in the SMTP settings UI
preserves the existing secret version rather than clearing it.

## MinIO / documents

- Private bucket, never public. Every read revalidates ownership (advisor
  ownership, or an active portal session/grant) before streaming bytes —
  never a bare signed-URL-only model with no server-side re-check at
  request time for sensitive paths.
- Uploads require an allow-listed MIME type **and** matching magic bytes, a
  random storage key, and a stored SHA-256 checksum.
- Case versions copy documents into an immutable per-version path — later
  edits to the live client record never retroactively change what a lender
  already received.

## External portal security

- Public review/access tokens: random per-contact, only SHA-256 hashes
  persisted.
- OTP: 6 digits, hashed, single-use, max 5 attempts, 10-minute expiry,
  resend rate-limited.
- Portal session: `HttpOnly`, `Secure` in production, scoped cookie path
  (`/api/external/portal`), CSRF-protected, 30-minute idle timeout, 12-hour
  absolute max, hash-only storage of the session token.
- External responses: `no-store`, `noindex`, `no-referrer`, frame denial,
  request IDs, Zod validation, Redis rate limits.
- Emails never attach PDFs or documents — sensitive content is only ever
  reachable through an authenticated portal session.

## API-wide controls

Helmet, a strict CORS allowlist, request IDs, body-size limits, upload-size
limits, sanitized error responses (no raw provider/stack-trace leakage to
clients), Redis-backed rate limiting.

## Logging / audit / PII rules

- Audit metadata must contain identifiers and action context **only** —
  passwords, tokens, secrets, authorization headers, and full PII are
  prohibited by policy and, per `SECURITY.md`, enforced in the audit-writer
  code path.
- OTP values, active links, and credentials must never appear in logs or
  admin-facing API responses.
- Only masked recipient addresses are ever shown to admins for email
  operational records — never the full address in bulk views.

## Operator SSH access (server-level, not application-level)

Live-confirmed 2026-08-29. Root cannot authenticate at all
(`PermitRootLogin no` + `AllowUsers syncash`). The only SSH-permitted
account, `syncash`, has both key auth (primary) and password auth (dev-period
fallback, scoped specifically to `syncash` via a `Match User syncash` block
in `sshd_config.d`, not a blanket global setting) — this is a deliberate,
user-approved decision for the current development period, not a
regression; see `docs/DECISIONS.md`. The password itself lives only in a
local, ACL-restricted file outside any repository
(`C:\Users\guyav\.syncash\credentials.env`) and is read only by a wrapper
script at connection time — no Claude session should ever read, log, or
print it.

## Never do (applies to any future SynCash work, not just this handoff)

- Never hardcode a secret or commit `.env*` (already `.gitignore`-covered;
  verified: `.env`, `.env.local`, `.env.*.local` all ignored, `.env.example`
  explicitly allowed).
- Never expose PostgreSQL, Redis, or MinIO ports to the internet.
- Never use localStorage as an authorization authority.
- Never rely on frontend-only RBAC — every check must have a server-side
  twin.
- Never fall back silently to a weaker secret source when Secret Manager
  fails — surface the failure instead.
