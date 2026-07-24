# SynCash Initial Audit

Date: 2026-07-21  
Branch: `codex-local-production-rebuild`  
Baseline commit: `b024f12`

## Executive summary

The imported repository contains the intended directory and file names, but it is not a complete or runnable application. Most core files are zero bytes, including `package.json`, `package-lock.json`, `server.ts`, the database schema and migration, authentication middleware, application shell, most components, types, styles, tests, and environment configuration. The surviving code is a partial AI Studio prototype containing frontend API contracts and a few server-side utilities, but there is no functioning backend that implements those contracts.

The project cannot currently install, typecheck, lint, test, build, migrate, or start. A production-style local rebuild is required rather than an incremental repair.

## 1. Project structure

- Frontend entry points: `index.html`, `src/main.tsx`, empty `src/App.tsx`, and mostly empty files under `src/components`.
- Backend entry point: empty `server.ts`; no routes are implemented.
- Database: `src/db/index.ts` exists, but `src/db/schema.ts`, `src/db/seed.ts`, Drizzle configuration, SQL migration, and Drizzle metadata are empty.
- Shared utilities: partial API client, mapper, audit writer, settings service, Firebase client, and secret-provider code.
- Tests: empty `runSecurityTests.ts`; no unit, integration, or E2E test directories.
- Infrastructure: no Dockerfiles or Compose file. `.env.example` and `.gitignore` are empty.
- Legacy tooling: AI Studio metadata and Netlify placeholders remain. `codex-bridge/` is unrelated workspace tooling and is outside the SynCash source scope.

## 2. Technologies visible in surviving code

- React and React Router with Vite.
- TypeScript.
- Tailwind Vite plugin and Lucide icons.
- Firebase Authentication client SDK.
- Express-style API contracts implied by frontend URLs, but no Express server exists.
- Drizzle ORM with PostgreSQL and `pg`.
- Google Secret Manager.
- Gemini is referenced in UI and README, but no backend integration exists.
- No Redis, S3/MinIO, SMTP, PDF, multipart, rate-limit, security-header, validation, testing, or Playwright implementation exists.

## 3. Demo and simulation mechanisms

- `src/utils/apiClient.ts` exposes `simulateLenderReply()` and calls `/api/lenders/simulated-reply`.
- The same file sends caller-controlled `advisorId` and `origin` when submitting to lenders.
- `src/components/SettingsView.tsx` claims Gemini is connected based only on local profile state and describes a fixed-template fallback.
- `src/utils/clientMapper.ts` manufactures liability values (`2000` and `3500`) from the mere presence of a mortgage balance.
- The anonymous submission builder is formatted demo text rather than a structured, allowlisted snapshot.
- The README and metadata identify the source as an AI Studio app rather than a deployable SynCash system.

No `Math.random`, `URL.createObjectURL`, demo JSON stores, or hard-coded lender email were found in the imported non-empty source. Their absence does not indicate a working replacement because the corresponding backend is missing.

## 4. Data sources

- PostgreSQL is referenced by `src/db/index.ts`, but it uses split `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_DB_NAME` variables instead of the required single `DATABASE_URL`.
- Database schema and migrations are empty, so no table or enum exists in executable code.
- `src/utils/settingsService.ts` reads settings from an undefined `system_settings` schema and falls back to environment variables and caller defaults after database errors.
- Google Secret Manager and environment variables are referenced by `src/utils/secretManager.ts`.
- Firebase config is imported from `firebase-applet-config.json`, which is empty and therefore unusable.
- No JSON data-store files are present, but no functioning database repository exists either.

## 5. Endpoint inventory

Only frontend calls exist; none has a server implementation:

- Authentication: `/api/auth/sync`, `/api/auth/me`.
- Advisors: `/api/advisors`, `/api/advisors/:id`.
- Clients: `/api/clients`, `/api/clients/:id`.
- Legacy documents: `/api/clients/:id/upload-doc`, `/api/clients/:id/delete-doc`, `/api/documents/download?clientId=&docId=`.
- Legacy submissions: `/api/clients/:id/send-to-lenders`.
- Gemini: `/api/clients/:id/ask-advisor`.
- Legacy identity reveal: `/api/clients/:id/reveal-lender/:lenderId`.
- Simulation: `/api/lenders/simulated-reply`.
- Lender administration: `/api/admin/lenders`, `/api/admin/lenders/:id`.
- Settings: `/api/admin/settings`, `/api/admin/settings/general`, `/api/admin/settings/email`, `/api/admin/settings/email/smtp-password`, `/api/admin/settings/email/test`, `/api/admin/settings/database/status`, `/api/admin/settings/database/test`, `/api/admin/settings/database/schema-status`, `/api/admin/settings/security/status`, `/api/admin/settings/security/encryption-test`, `/api/admin/settings/audit`.

## 6. Unprotected endpoints

There are no backend endpoints and therefore no server-side authentication or authorization. The frontend uses Firebase bearer tokens for most calls, but client-side token attachment is not access control. Required middleware such as `requireFirebaseAuth`, `loadDatabaseUser`, `requireActiveUser`, role checks, advisor ownership checks, lender-submission ownership checks, and admin checks does not exist.

## 7. Browser storage

No `localStorage` or `sessionStorage` usage was found in the imported source. Authentication state is delegated to Firebase client persistence, but the empty application shell prevents verification of the actual login lifecycle.

## 8. JSON usage

- `firebase-applet-config.json` is an empty tracked configuration file.
- `metadata.json` contains AI Studio metadata and mojibake text.
- Drizzle metadata JSON files are empty and invalid.
- API requests and responses use JSON, but there is no server implementation or validation.
- No legacy client/advisor/settings/vault JSON stores were found.

## 9. Dead code

- All frontend API methods are effectively dead because `server.ts` is empty.
- `src/utils/clientMapper.ts`, `src/utils/audit.ts`, and `src/utils/settingsService.ts` import an empty schema and cannot compile.
- `src/components/SettingsView.tsx` imports an empty `src/types.ts` and cannot compile.
- `src/main.tsx` imports an empty `src/App.tsx` with no default export.
- Empty component, middleware, schema, seed, crypto, style, and test files are placeholders rather than functioning code.

## 10. Legacy code

- AI Studio README, metadata, HMR comments, and Netlify placeholder.
- Simulated lender reply endpoint and compatibility-style API paths.
- Role labels are derived in the API client and mixed with stable role identifiers.
- Client mapper returns a broad legacy frontend object and duplicates lender state by both ID and name.
- Legacy document routes use query/body document identifiers instead of resource-oriented, ownership-checked endpoints.

## 11. Secrets and credentials

- No populated credential was found in the imported files.
- `.env.example` and Firebase config are empty.
- `GoogleSecretManagerProvider` silently falls back to environment variables when cloud retrieval fails.
- `GoogleSecretManagerProvider.setSecret()` mutates `process.env` at runtime.
- Google project ID has a weak hard-coded default (`syncash-project`).
- Secret-provider errors include raw provider messages and may expose sensitive operational details.
- The provider contract incorrectly requires `setSecret` for every provider instead of making it optional.

## 12. Tests

- `runSecurityTests.ts` is empty.
- No Vitest configuration or tests exist.
- No Supertest integration tests exist.
- No Playwright configuration or E2E tests exist.
- No test database, fake Firebase verifier, in-memory secrets fixture, MinIO fixture, or Mailpit workflow exists.

## 13. Migrations

- `drizzle/0000_fast_silhouette.sql` is empty.
- `drizzle/meta/_journal.json` and `drizzle/meta/0000_snapshot.json` are empty and invalid.
- Both Drizzle configuration files are empty.
- No schema can be generated or migrated and a blank database cannot be initialized.

## 14. package-lock.json

`package.json`, `package-lock.json`, and `bun.lock` are zero bytes. `npm install`, `npm ci`, dependency audit, scripts, and reproducible builds are impossible.

## 15. Build and TypeScript failures

- Dependency installation cannot start because `package.json` is empty.
- TypeScript cannot resolve packages or empty module exports.
- The empty `App.tsx`, `types.ts`, and schema files break imports.
- The Vite config references packages that are not declared.
- The project has no backend TypeScript configuration or build output strategy.

## 16. Lint failures

No ESLint configuration, lint script, or dependency manifest exists. Surviving code also uses pervasive `any`, raw console logging, unsafe error interpolation, and mixed browser/server modules under one source tree.

## 17. Frontend/backend gaps

- Every API call lacks a backend implementation.
- Client CRUD does not match the required pagination, search, PATCH, ownership, validation, soft-delete, and audit semantics.
- Document paths do not match the required upload/download authorization model.
- No lender invite route, authenticated lender portal, anonymous JSON snapshot, anonymous PDF, identity request workflow, offers workflow, notifications, email delivery state, or retry flow exists.
- The frontend sends `advisorId` and origin values that the backend must not trust.
- Role translation is performed in the client and collapses multiple roles into display labels.
- Direct document download uses `fetch` instead of the shared authenticated client behavior.
- No API error schema, request ID, pagination contract, or validation contract exists.

## Security-critical findings

- No server-side authentication or authorization exists.
- `mapDbClientToFrontend()` permits every `ADVISOR` to decrypt PII without checking client ownership.
- It also permits `ADMIN` to decrypt all PII despite the stated role boundaries.
- The anonymous text snapshot includes free-form notes, which can contain names, addresses, employers, and other PII.
- It derives anonymized output from a broad mapped client object rather than a strict database allowlist.
- Audit logging suppresses write failures and accepts arbitrary metadata without redaction.
- Settings suppress database read failures and silently fall back to environment/default values.
- No CORS allowlist, Helmet, body limits, upload limits, safe error handler, request IDs, or Redis-backed rate limiting exists.
- No AES-256-GCM implementation exists despite encrypted columns being referenced.
- No file MIME, magic-byte, checksum, private-bucket, signed-URL, or ownership controls exist.

## Initial command status

- `npm ci`: cannot run against an empty manifest and lockfile.
- `npm audit`: cannot produce a meaningful project audit without dependencies.
- `npm run typecheck`: script absent.
- `npm run lint`: script absent.
- Unit, integration, and E2E tests: absent.
- `npm run build`: script absent.
- `docker compose ps`: no Compose file exists.

This report describes the imported baseline only. It does not claim the system is ready or secure.
