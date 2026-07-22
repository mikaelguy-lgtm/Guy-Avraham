# SynCash Local Production Rebuild Report

Date: 2026-07-22
Branch: `codex-syncash-production-rebuild`  
Deployment performed: no  
Remote push or PR performed: no

## Origin/main transplant verification — 2026-07-22

- Created `codex-syncash-production-rebuild` directly from `origin/main` at `6a5e5990c514de8979cd58e94653e30e6251205a`.
- Protected the completed local state with tag `backup-syncash-local-complete` at `c01e0e32562d5c8752f0c85625f9f81421e0b5d9`.
- Chronological cherry-picking was rejected because the first local commit was a full-tree import that overlapped the existing origin tree. The final tracked tree was transplanted exactly from the protected tag, preserving origin/main as the parent history.
- The transplanted tree hash matched the protected source tree: `4aa5bb2db9b20feb761c24a4581b7455c1ef2c8f`.
- Secret scanning found no private keys, bearer tokens, tracked runtime environment files, Google API keys in the final tree, or high-confidence runtime secrets. The public Firebase web configuration inherited in origin/main history is removed by the transplant commit.
- `npm ci` passed. `npm audit` reports 15 moderate transitive development/tooling findings and no high or critical findings. `npm audit fix` makes no safe changes; npm only proposes breaking downgrades of current Firebase and Drizzle tooling, so no forced downgrade was applied.
- `npm run db:check` passed inside the API container. The host invocation cannot resolve the Compose-only hostname `postgres`, which is intentionally not published to the host.
- `npm run typecheck`, `npm run lint`, `npm run test:unit` (34/34), `npm run test:integration` (53/53), `npm run test:e2e` (7/7), and `npm run build` passed.
- Docker Compose configuration passed and all seven required services were healthy: `api`, `frontend`, `firebase-auth`, `postgres`, `redis`, `minio`, and `mailpit`.
- No deploy, push, merge, force-push, production-data access, or origin/main modification was performed.

## Final client-module delivery audit — 2026-07-22

### Browser delivery result

- A real Chromium session created `בדיקת מסירה` as case `SC-7A6D461A262843F2`, verified it, and removed it during test cleanup.
- Required-field navigation was blocked until each visible required field was valid; Hebrew inline validation appeared below the fields.
- Marital status, two separate child ages, employment, additional income, liabilities, mortgage balance, mortgage payment, property address, and financing data were created and persisted.
- Gross income was absent from create, edit, and detail screens.
- Calculations matched the entered values: total income `23,000` ILS, total payments `5,000` ILS, repayment ratio `21.74%`, and financing percentage `60%`.
- Edit and refresh persistence was verified for marital status, child age, additional-income type/amount, and deal type.
- All 14 supported deal types were saved, reloaded into the editor, displayed in Hebrew, and checked to ensure the raw enum was not rendered.
- The client delivery page completed with no browser console errors and no failed network requests.
- The responsive visual suite passed at mobile `390px`, tablet `768px`, and desktop `1440px`, including the no-horizontal-overflow checks.
- Playwright fixture cleanup found zero remaining active records for the dedicated E2E email addresses; permanent development users and manually entered clients were not changed.

### Anonymous snapshot

- The snapshot allowlist contains only: public case number, deal type, property type, region, property value, requested amount, financing percentage, total monthly income, total monthly payments, existing mortgage balance, requested term, and general employment type.
- The exact-key unit test rejects names, email, phone, address, advisor/client IDs, marital status, children/ages, employer, and professional notes.
- The lender-browser flow confirmed that identifying client data was hidden before approval. A lender requested name and phone, the advisor approved only phone, and the lender saw only the approved phone field.

### Documents and lender workflow

- A PDF was uploaded, retained after refresh, opened in the authenticated in-app preview, downloaded, and matched its original SHA-256 checksum. The reload/download round trip exercises PostgreSQL metadata and private MinIO storage.
- Cross-advisor document access remains covered by the `403` integration assertion.
- A financing company was selected and the case was submitted. The invitation arrived in Mailpit, the authenticated lender opened it, and only the anonymous snapshot was visible.
- Partial identity disclosure was enforced field-by-field, and the lender submitted an offer that became visible to the owning advisor.
- An unrelated lender remained unable to access the submission.

### Final command results

```text
npm ci                 PASS — 1099 packages installed, 1100 audited
npm audit              REVIEW — 15 moderate, 0 high, 0 critical
npm audit fix          REVIEW — no non-breaking resolution available
npm run db:check       PASS — database syncash checked from the API container
npm run typecheck      PASS
npm run lint           PASS — zero warnings
npm run test:unit      PASS — 9 files, 26 tests
npm run test:integration PASS — 1 file, 41 tests
npm run test:e2e       PASS — 6 Chromium tests
npm run build          PASS — web and API builds
docker compose ps      CLI unavailable in the host PATH
Docker Engine API ps   PASS — 7 services running and healthy
```

The remaining audit findings are moderate transitive advisories in development/tooling chains (`firebase-tools`, `drizzle-kit`, `@modelcontextprotocol/sdk`, Google Cloud dependencies). npm proposes breaking downgrades/changes under `npm audit fix --force`; no forced dependency change was applied during final verification.

### Docker and local URLs

- `frontend`: healthy — `http://localhost:5173`
- `api`: healthy — `http://localhost:3000`
- `firebase-auth`: healthy — `http://localhost:9099`
- `mailpit`: healthy — `http://localhost:8025`
- `minio`: healthy — API `http://localhost:9000`, console `http://localhost:9001`
- `postgres`: healthy, internal only
- `redis`: healthy, internal only

### Final browser artifacts

- `output/playwright/final-client-delivery.png`
- `output/playwright/advisor-login.png`
- `output/playwright/advisor-dashboard.png`
- `output/playwright/advisor-wizard-step-1.png`
- `output/playwright/advisor-wizard-step-2.png`
- `output/playwright/advisor-wizard-step-3.png`
- `output/playwright/advisor-client-details.png`
- `output/playwright/advisor-documents.png`
- `output/playwright/advisor-financing-arena.png`
- `output/playwright/advisor-mobile-390.png`
- `output/playwright/advisor-tablet-768.png`
- `output/playwright/advisor-desktop-1440.png`

## 1. Commits

```text
b024f12 chore: snapshot imported SynCash source
883c795 docs: record imported code audit
b2f921f chore: establish local infrastructure and database
1f5f28d feat: implement secure authenticated business API
446e1ac feat: implement authenticated advisor and lender portals
45044c2 test: add security integration and end to end coverage
c52c88f docs: add local and production deployment guides
8ad5c58 test: align PDF extraction types
cd06399 feat: add notifications retries and admin controls
60744dd test: complete advisor to lender e2e scenario
```

## 2. Removed files and legacy mechanisms

- Removed empty `bun.lock`.
- Removed empty tracked Firebase applet JSON configuration.
- Removed empty Netlify configuration.
- Removed AI Studio metadata.
- Removed empty legacy security-test runner.
- Removed legacy client mapper, settings fallback service, and best-effort audit wrapper.
- Removed the lender reply simulator and `/api/lenders/simulated-reply` client contract.
- Removed caller-controlled advisor identity from submission requests.
- Removed fixed-template Gemini fallback claims and fake connection status.
- Removed split SQL connection variables in favor of `DATABASE_URL`.
- No JSON data store, business `localStorage`, fallback demo mode, fake lender email, hard-coded responder, wildcard CORS, MinIO public endpoint, or default `minioadmin` credential remains.

## 3. Added files and systems

- Docker: `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.frontend`, `.dockerignore`.
- Configuration: validated `.env.example` and `src/config/env.ts`.
- Database: 22-table Drizzle schema, eight PostgreSQL enums, generated SQL migration, migration/check/seed scripts.
- Security: Firebase Admin verifier, active-user checks, RBAC, advisor ownership, lender-company ownership, AES-256-GCM, secret-provider implementations, safe errors, request IDs, CORS allowlist, Helmet, body/upload limits, Redis rate limiting.
- Storage: private S3/MinIO object service, MIME and magic-byte validation, random keys, checksums, soft deletion, ownership-checked downloads.
- Workflows: client CRUD, anonymous snapshots/PDFs, invite hashing/expiry/revocation/consumption, SMTP delivery states and retry, lender replies, granular identity requests, selective disclosure, offers, notifications, audit logs, backend Gemini.
- UI: Firebase login, advisor dashboard, client creation, document upload/download, lender selection/submission, identity approvals, offer comparison, authenticated lender portal, Super Admin SMTP controls.
- Tests: Vitest unit tests, Supertest integration tests, Playwright full-flow scenario.
- Documentation: audit, architecture, security, local development, Contabo deployment plan, backup/restore, and this report.

## 4. Docker structure

Services are `frontend`, `api`, `postgres`, `redis`, `minio`, and `mailpit`. PostgreSQL and Redis have no host ports and use the internal backend network. Persistent volumes exist for PostgreSQL, Redis, MinIO, and container node modules. Startup dependencies use health conditions. Frontend and API source mounts support hot reload.

## 5. Database and migrations

The schema contains `users`, `advisor_profiles`, `lenders`, `lender_users`, `clients`, `borrowers`, `employment_records`, `income_sources`, `liabilities`, `properties`, `loan_requests`, `documents`, `lender_submissions`, `lender_responses`, `identity_reveal_requests`, `loan_offers`, `notifications`, `audit_logs`, `email_logs`, `ai_analysis_logs`, `lender_invite_tokens`, and `system_settings`.

PostgreSQL enums are connected to columns for user roles/status, client status, document status, submission status, response type, offer status, and identity-request status. Runtime, Drizzle Kit, migrations, checks, and seeds use `DATABASE_URL`.

## 6. Authentication and RBAC

Protected routes require a Firebase bearer token, Firebase Admin verification, a matching PostgreSQL user, `status === ACTIVE`, and `deletedAt IS NULL`. Roles and memberships are loaded from PostgreSQL. Advisor and lender IDs supplied by the browser are never trusted. Lender access compares the authenticated user's lender membership with the submission lender.

## 7. Documents

Uploads use multipart `FormData`. The API validates size, declared MIME, and magic bytes before writing to the private bucket. Metadata and SHA-256 checksums are stored in PostgreSQL. Advisor downloads re-check client ownership. Lender downloads require an approved `SPECIFIC_DOCUMENTS` disclosure and an allowlisted document ID.

## 8. Lender portal, disclosure, and offers

The public invite endpoint returns only lender name and the requirement to authenticate. Tokens are 32 random bytes; only SHA-256 hashes are stored. Tokens expire, can be revoked, become single-use, and are replaced on retry. After login, portal access is session/user based and restricted to the lender company.

Anonymous portal data and PDFs come only from the strict financial snapshot. Identity disclosure supports allowlisted fields, partial approval, and specific documents. Offers always use the authenticated user as creator and are visible to the owning advisor.

## 9. SMTP and Gemini

SMTP configuration is restricted to `SUPER_ADMIN`. Passwords are stored only through `SecretProvider`, never returned, and represented by `passwordConfigured`. Database-backed SMTP settings are used by the live transporter. Errors are sanitized before logs/API responses. Delivery success becomes `SENT`; failure becomes `DELIVERY_FAILED`; retry is explicit and revokes older tokens.

Gemini is called only from the backend with authentication, advisor ownership, rate limiting, timeout, prompt-size limit, anonymous financial context, and AI logs. The API key is not present in frontend code.

## 10. Test results

### `npm ci`

```text
Exit code: 0
added 664 packages, and audited 665 packages in 56s
10 moderate severity vulnerabilities
```

### `npm audit`

```text
Exit code: 1
10 moderate severity vulnerabilities
0 high severity vulnerabilities
0 critical severity vulnerabilities

Remaining groups:
- drizzle-kit -> @esbuild-kit/esm-loader -> esbuild (moderate development-server advisory)
- firebase-admin Google Cloud transitive packages -> uuid (moderate bounds-check advisory)
```

The nonzero exit is caused by the documented moderate findings. `npm audit fix --force` proposes incompatible downgrades and was not applied.

### `npm run typecheck`

```text
Exit code: 0
tsc --noEmit && tsc -p tsconfig.server.json --noEmit
```

### `npm run lint`

```text
Exit code: 0
eslint . --max-warnings=0
```

### `npm run test:unit`

```text
Exit code: 0
Test Files  4 passed (4)
Tests       10 passed (10)
```

Coverage includes AES-GCM round trips, tampering, wrong key, random IV, key length, token hashing, environment validation, email-error sanitization, snapshot allowlisting/LTV, and PDF text extraction/PII exclusion.

### `npm run test:integration`

```text
Exit code: 0
Test Files  1 passed (1)
Tests       23 passed (23)
```

Coverage includes missing/invalid tokens, suspended users, cross-advisor access, Super Admin SMTP, real/fake uploads, cross-advisor downloads, lender-company isolation, protected replies/offers/disclosure, approved-field filtering, unapproved documents, invite expiry/revocation/use/minimal response/rate limiting, SMTP success/failure, and no automatic lender response.

### `npm run build`

```text
Exit code: 0
Vite: 62 modules transformed
Frontend build completed
API TypeScript build completed
```

### `npm run test:e2e`

```text
Exit code: 1
Chromium installed successfully and Playwright launched.
Blocking error: All E2E advisor, lender, and other-lender credentials are required.
```

The full scenario is implemented: advisor login, client creation, real PDF upload, refresh persistence, download checksum, lender selection, Mailpit invitation retrieval, lender login, anonymous PII checks, identity request, partial advisor approval, selective reveal, offer creation/advisor visibility, and a second lender isolation check.

### `docker compose ps`

```text
Exit code: 1
docker: command not found
```

Docker Compose, PostgreSQL health, Redis health, MinIO health, Mailpit health, blank-database migration, seed, and live E2E execution could not be validated on this machine because Docker is not installed.

## 11. Remaining blockers

The system is not declared production-ready. Two external prerequisites remain:

1. Install Docker Desktop/Compose and run the documented Compose, migration, seed, and health checks.
2. Provide synthetic Firebase E2E accounts for an advisor, assigned lender, and different-company lender, then set all documented `E2E_*` variables and rerun Playwright.

No deployment, DNS change, production connection, remote push, PR, or modification to `master` was performed.

## 12. עדכון מסירה — הרשמה עצמית מאובטחת ליועצים

סעיף זה מחליף את סטטוס האימות והחסמים הישנים בסעיפים 10–11 לעיל. סביבת Docker המקומית זמינה וכל בדיקות המסירה הושלמו.

### Migration

- `drizzle/0003_sloppy_justin_hammer.sql`
- נוספו `users.email_verified`, `advisor_profiles.business_phone_encrypted` ו־`advisor_profiles.business_email` ללא מחיקה או שינוי הרסני.
- משתמשי פיתוח פעילים קיימים סומנו כמאומתים, ודוא״ל עסקי קיים מולא באופן בטוח.

### API

- `POST /api/auth/login-attempt`
- `POST /api/auth/register-advisor`
- `GET /api/auth/me`
- `POST /api/auth/email-verification/resend`
- `PATCH /api/advisor/profile`
- `GET /api/admin/advisors`
- `PATCH /api/admin/advisors/:id/status`
- `POST /api/admin/advisors/:id/resend-verification`
- `DELETE /api/test/advisors/:id` — זמין רק מחוץ ל־Production ורק לחשבונות `@syncash-e2e.local`.

### אבטחה וזרימה

- Firebase Authentication הוא מקור ה־UID והדוא״ל; ה־Backend אינו מקבל `role`, `status` או `firebaseUid` מהדפדפן.
- משתמש חדש נשמר ב־PostgreSQL כ־`ADVISOR`, ‏`PENDING`, ‏`emailVerified=false` בתוך Transaction.
- סיסמה נשמרת רק ב־Firebase ואינה נשלחת ל־API, למסד, ללוגים, ל־Audit או לאחסון דפדפן.
- רק token עם `email_verified=true` מפעיל מעבר אידמפוטנטי ל־`ACTIVE`.
- טלפון מנורמל לפורמט ישראלי בינלאומי ומוצפן לפני שמירה.
- Rate limiting פעיל להרשמה, שליחת אימות וכניסה; מגבלת Production לכניסה נשארה 10 ניסיונות ב־15 דקות.
- כשל PostgreSQL לאחר יצירת Firebase גורר ניסיון מחיקה בטוח של משתמש Firebase מה־Frontend.

### UI

- מסך הרשמה עברי ו־RTL ב־`/register/advisor`, עם Validation, חיווי חוזק, הצגה/הסתרת סיסמה, Loading ומניעת לחיצה כפולה.
- מסך אימות דוא״ל ייעודי עם בדיקה מחדש, שליחה חוזרת וחזרה לכניסה.
- פרופיל יועץ ניתן לעריכה עבור שם, טלפון ושם חברה; דוא״ל, הרשאה וסטטוס אינם ניתנים לעריכת היועץ.
- מסך Super Admin מציג יועצים, אימות, סטטוס, הרשמה, פעילות ופעולות הפעלה/השעיה/השבתה/צפייה/שליחת אימות.

### תוצאות סופיות

```text
npm run db:generate       PASS — no schema changes pending
npm run db:migrate        PASS
npm run db:check          PASS — database syncash
npm run typecheck         PASS
npm run lint              PASS
npm run test:unit         PASS — 31/31
npm run test:integration  PASS — 49/49
npm run test:e2e          PASS — 7/7
npm run build             PASS
```

כל שבעת שירותי Compose רצים ובריאים: `api`, `frontend`, `firebase-auth`, `postgres`, `redis`, `minio`, `mailpit`. פקודת `docker compose ps` אינה זמינה ב־PATH של מעטפת Codex, ולכן הסטטוס אומת ישירות מול Docker Engine API. אין חשבונות יועץ פעילים בדומיין הבדיקות לאחר הניקוי.

אין חסם מקומי שנותר. לא בוצעו Deploy, Push, Pull Request, Merge, שינוי DNS, גישה לנתוני Production או שינוי ב־`master`.

## 13. תיקון אימות דוא״ל וחוויית סיסמה

### גורם השורש

ה־Frontend יצר משתמש Firebase והפעיל `sendEmailVerification`, אך Firebase Authentication Emulator אינו שולח הודעה דרך SMTP. ה־Backend יצר משתמש PostgreSQL ורשם Audit כאילו ההודעה נשלחה, בלי להפעיל את `EmailService`, בלי להמתין ל־`sendMail()` ובלי ליצור `email_logs`. לכן הוצגה הצלחה מדומה.

### התיקון

- נוסף `EmailVerificationService` מרכזי עם `ProductionFirebaseVerificationLinkProvider` ו־`EmulatorFirebaseVerificationLinkProvider`.
- שני ה־Providers משתמשים ב־Firebase Admin הרשמי וב־Continue URL שמקורו רק ב־`APP_URL`.
- השירות יוצר תבנית עברית ו־RTL בגרסאות HTML/Text, מבצע `transporter.verify()`, שולח דרך הגדרות ה־SMTP האחרונות ושומר `messageId` מסונן.
- `POST /api/auth/register-advisor` מחזיר `verificationEmailSent: true` רק לאחר קבלת `messageId` ושמירת `email_log`.
- כשל SMTP משאיר את היועץ `PENDING`, מחזיר Request ID ומאפשר Resend; משתמש Firebase/PostgreSQL שכבר נוצר אינו נמחק.
- `POST /api/auth/email-verification/resend` משתמש באותו שירות ומוגבל לפעם בדקה וחמש פעמים בשעה.
- נוספו `GET /api/auth/email-verification/status` ועמודות `user_id`, `template`, `request_id` ב־`email_logs` באמצעות `drizzle/0004_hot_captain_stacy.sql`.
- לוגי Firebase Emulator מסוננים ברמת Compose כך שקישורי OOB אינם נכתבים ללוגי המכולה.

### מסך הסיסמה

- שני השדות קבועים ברוחב מלא ובגובה 48px, עם `min-width: 0` ו־Grid יציב ללא Layout Shift.
- אייקון העין ממוקם בתוך השדה ואינו משפיע על מידותיו.
- שבעת התנאים מוצגים תמיד עם מצב ניטרלי/תקין/שגוי, `aria-live`, אייקון וטקסט שאינם מסתמכים רק על צבע.
- מד החוזק מציג חלשה/בינונית/חזקה/חזקה מאוד ואינו משנה את גובה הטופס.
- כפתור יצירת החשבון חסום עד שכל השדות, התנאים והתאמת הסיסמאות תקינים.

### אימות סופי

```text
npm run typecheck         PASS
npm run lint              PASS
npm run test:unit         PASS — 34/34
npm run test:integration  PASS — 53/53
npm run test:e2e          PASS — 7/7
npm run build             PASS
docker compose config     PASS
docker compose ps         PASS — 7/7 healthy
API logs, 300 lines       0 errors, 0 sensitive patterns
Frontend logs, 300 lines  0 errors, 0 sensitive patterns
Firebase Auth logs        0 errors, 0 OOB links after filtering
```

Playwright אימת ב־390px, ‏768px ו־1440px שאין שינוי בגודל שדות הסיסמה או גלילה אופקית; ההודעה הגיעה בפועל ל־Mailpit, הקישור מתוך ההודעה הפעיל את Firebase וה־`email_log` נשמר. ספק ה־SMTP הפעיל בבדיקה היה `mailpit:1025`. Gmail לא נבדק בפועל משום שההגדרה הפעילה אינה Gmail ולא סופקה כתובת בדיקה חיצונית; לא נעשה שימוש בסיסמת Gmail ולא בוצע fallback שקט.
