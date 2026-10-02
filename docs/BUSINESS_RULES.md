# SynCash — Business Rules

Compiled 2026-08-28 from direct source-code reads (file:line cited). This
reflects the current **working tree** (including uncommitted changes), which
is ahead of both GitHub and the last known Production release — see
`docs/PRODUCTION_HANDOFF.md` section 5.

## Roles

`SUPER_ADMIN`, `ADMIN`, `ADVISOR`, `LENDER_ADMIN`, `LENDER_UNDERWRITER`
(`src/db/schema.ts:19`, `src/domain/types.ts:1`).

- `SUPER_ADMIN`: system settings, SMTP configuration, users, DB/security
  status, sensitive audit access. Also the only role that can edit another
  user's profile/email, disable/enable, archive/restore, trigger an
  admin-initiated password-reset email, resend email verification, and
  create/edit/publish/archive legal document versions (Terms of Service,
  Privacy Policy) — see the 2026-08-30 section below.
- `ADMIN`: general business administration; no SMTP secret, DB, encryption,
  or sensitive audit access.
- `ADVISOR`: only their own assigned clients, documents, submissions,
  disclosure decisions. Enforced server-side via
  `requireAdvisorClientAccess` (`src/middleware/auth.ts:94-108`).
- `LENDER_ADMIN` / `LENDER_UNDERWRITER`: only submissions belonging to their
  lender company, via `requireLenderSubmissionAccess`
  (`src/middleware/auth.ts:110-124`).

Changing an ID in a URL never broadens access — every ownership check runs
server-side before data is loaded or mutated.

## Submission lifecycle

1. Manager creates an inactive lender company, adds active contacts, then
   activates it.
2. Advisor never selects companies (see 2026-08-29 update below). Server
   verifies advisor ownership, deal details, loan purpose, and every
   required document.
3. Server builds a masked preview and a short-lived signed preview.
4. On approval, one transaction creates a delivery batch and an immutable
   case version; PDFs/documents are copied to a private, immutable path.
5. A `company_submissions` row is created per company, plus a personal
   `submission_contact_invitations` row per active contact.
6. Outbox sends a personal email with **no attachment**; status updates only
   after a real SMTP response.

## Response deadline (`src/services/israelBusinessCalendar.ts`)

- Send day does not count.
- Deadline = 2 Israeli business days after send, computed in `Asia/Jerusalem`
  (`calculateResponseDeadline`, line 72-74), at **18:00** local time
  (`atLocalTime`).
- Friday/Saturday and fixed Jewish holidays (Rosh Hashana, Yom Kippur,
  Sukkot, Simchat Torah, Pesach first/last day, Shavuot — computed via the
  Hebrew calendar formatter, `isFixedIsraeliHoliday`, lines 34-42) are not
  business days. DB-driven `business_calendar_exceptions` overrides take
  precedence over the fixed rules.
- Reminders fire at **09:00** and **15:00** local time on the deadline day
  only, and only while no decision exists (`calculateReminderSchedule`,
  lines 76-79).
- All local-time math goes through `Intl.DateTimeFormat` with an iterative
  DST-correction loop (`atLocalTime`, lines 22-32) — no hardcoded UTC
  offsets found anywhere in `src/`.

## Decision flow ("first valid decision wins")

- `NOT_INTERESTED` can close immediately once committed.
- `INTERESTED` only becomes final after a valid OTP.
- Starting an OTP challenge does not lock out other contacts at the same
  company; a row lock on `company_submissions` ensures only the first
  successful commit wins the race.
- Once a decision is final: other invitations, reminders, and OTP challenges
  for that submission are closed.

### Single-OTP portal flow (2026-08-01 change — see `docs/DECISIONS.md`)

`POST /api/external/review/:token/interested/verify` is now the single
transition point: it consumes the one-use interest OTP, records the
decision, activates the disclosure grant, creates the portal session, and
sets the session cookie in one step. The company is **not** sent a second
"full access" email — the frontend redirects straight to `/external/portal`.
Legacy access-grant links still work and skip a second OTP if a valid
session already exists for that grant.

## External portal access

- A valid `INTERESTED` decision creates a personal access grant valid for
  **7 calendar days**.
- Every entry requires a personal OTP; afterward an `HttpOnly` (Secure in
  production) session cookie is issued, scoped to `/api/external/portal`,
  with a **30-minute idle timeout** and a **12-hour absolute maximum**
  session lifetime.
- The portal shows the fixed case version, advisor details, full PDF,
  documents, and ZIP — never any other company's or case's data (verified
  by ownership checks, not just URL structure).
- Extension or cancellation is admin-only; cancellation also kills existing
  sessions.
- No offer form or offer-submission endpoint exists anywhere in the product
  as of 2026-08-29 (see update below) — the portal is view/decision-only.

## Worker

Handles email outbox delivery/retry, reminders, expirations, OTP cleanup,
and session cleanup under a PostgreSQL advisory lock (prevents double
processing across multiple worker instances).

## SSE / realtime

Decision and access events are sent only to the owning advisor and
authorized managers — no PII broadcast to unrelated users.

## Email rules

- SMTP is configured dynamically (Draft → Test → Activate → Rollback) via
  `email_configurations` in Postgres + a Secret Manager reference — never a
  restart/redeploy to swap providers. See `src/services/email.ts` and
  `SMTP_DYNAMIC_CONFIGURATION.md`.
- Emails never carry attachments for sensitive documents — the flow uses a
  portal link instead.
- "SMTP accepted" is never presented as "delivered". Recipient emails are
  shown masked; resend has a 60-second cooldown, idempotency, and an
  attempt limit.
- OTP values, active links, and credentials are never written to logs or
  admin-facing responses.

## Timezone

All timestamps are stored in UTC. Display uses one centralized formatter
(`src/utils/formatters.ts`, `ISRAEL_TIME_ZONE = "Asia/Jerusalem"`,
`he-IL` locale, `DD/MM/YYYY HH:mm`). Cooldowns and expiries always compare
absolute instants, never formatted local-time strings.

### Dashboard greeting (`getIsraelTimeGreeting`, `src/utils/formatters.ts:201-207`)

Hour is derived strictly from `Asia/Jerusalem` (`getIsraelHour`, never the
browser's local time):

| Local hour range | Greeting |
| --- | --- |
| 05:00–11:59 | בוקר טוב |
| 12:00–17:59 | צהריים טובים |
| 18:00–22:59 | ערב טוב |
| 23:00–04:59 | לילה טוב |

All boundary values match spec, including the `21:54 → ערב טוב` regression
case from the original incident.

## Married borrowers (`borrowerRelationship === "MARRIED"`)

Enforced independently at two layers so a crafted API request cannot bypass
it:

- **Server (canonical)**: `canonicalizeMarriedBorrowers`
  (`src/domain/clientValidation.ts`), run as a Zod `preprocess` before
  both the create and personal-update schemas. Forces every borrower's
  marital status to `MARRIED` and every non-primary borrower's `city` and
  `streetAddress` to the primary borrower's values (address is a split
  city/street pair as of 2026-08-29, see update below).
- **Client**: `applyBorrowerRelationship` (`src/utils/clientForm.ts:92-123`)
  mirrors this in the form state, and stashes the previous per-borrower
  values so they can be restored if the relationship changes away from
  married.
- Liabilities move to a household-level list instead of per-borrower when
  married (`liabilities_scope_check` in `src/db/schema.ts:229`).

## Numeric validation

All count fields reject signs/decimals/scientific notation; monetary fields
accept zero and reject negative or malformed input. Enforced at three
layers: frontend, API/domain (Zod), and PostgreSQL `CHECK` constraints —
confirmed present for borrowers, children, income, liabilities, property,
loan amounts, documents, offers, analysis metrics, SMTP port, case versions,
invitations, and OTP/outbox attempt counts.

## Requirement audit — pending items from the handoff brief (section 33)

| Requirement | Status | Evidence |
| --- | --- | --- |
| Remove marital status "פרוד" (SEPARATED) | **Legacy-only, not deleted** | Excluded from `SELECTABLE_MARITAL_STATUSES` and rejected for new records (`src/domain/clientFields.ts`, `clientValidation.ts:185`), but still valid on existing records (`app.ts:251-256`), still in the DB `CHECK` constraint (`schema.ts:132,167`), and still labeled (`formatters.ts:64`). |
| "בעל שליטה" → "שכיר בעל שליטה" | **Done** | Label updated in `formatters.ts:38`; enum key (`CONTROLLING_SHAREHOLDER`) unchanged, still fully selectable. |
| Remove "עובד מדינה" / "עובד מערכת הביטחון" | **Legacy-only, not deleted** | Same pattern as SEPARATED: excluded from the new-record dropdown, blocked on new selection, but still valid on existing records and in the DB constraint. |
| Add "מוסד תורני" (Torah institution) | **Done** | Fully selectable for new records; DB constraint and label both present. |
| Additional income as dynamic array (not `additionalIncome1/2/3`) | **Done** | No hardcoded numbered fields exist. Proper `incomeSources` table with `sortOrder`, full CRUD in UI (`ClientFormFields.tsx`) with add/delete per row. |
| "שכיר" as an additional income type | **Done** | `SALARIED` present in `ADDITIONAL_INCOME_TYPES`, labeled "שכיר". |
| Add "שכירות" (rent) as a liability type | **Done** | `RENT` in `LIABILITY_TYPES`, DB constraint, and UI dropdown. |
| "גוף פיננסי" (free-text) shown only for LOAN/MORTGAGE; hidden/null for ALIMONY/RENT | **Done — confirmed correct 2026-08-29** | `LOAN`/`MORTGAGE` → free-text input shown and required (`ClientFormFields.tsx:55`, `clientValidation.ts:67,70-71`, `clientForm.ts:134`); `ALIMONY`/`RENT` → field hidden and forced `null` (DB `liabilities_institution_relevance_check`, `schema.ts:232`). **Correction**: an earlier pass of this audit (2026-08-28) reported this as "wired backwards" — that was a misreading of the requirement. The user confirmed 2026-08-29 that LOAN/MORTGAGE→visible, ALIMONY/RENT→hidden/null is the correct, final behavior and must not be flipped. |
| "יתרה נוכחית" not shown/required, stays null (never 0), for ALIMONY/RENT | **Done** | Column has no default, never coerced to 0 anywhere in `store.ts`; hidden in the UI for ALIMONY/RENT; unaffected for LOAN/MORTGAGE (existing business rule keeps applying there). DB-level `liabilities_balance_relevance_check` now covers both `RENT` and `ALIMONY` explicitly (fixed 2026-08-29 during the git reconciliation audit — previously named only `RENT`; live-confirmed in Production's actual constraint definition after the `3f5685e` deploy). |
| Resetting `financialInstitution`/`currentBalance` to null when the liability type is changed away from a type that used them | **Done, verified at the API layer too** | `ClientFormFields.tsx:47` (`updateType`) and `clientForm.ts:201` (`liabilityPayload`) both null the irrelevant fields based on the final selected type. Additionally confirmed 2026-08-29 with a dedicated integration test (`tests/integration/api.test.ts`, "rejects a raw PATCH that changes liability type but leaves stale institution/balance values") that a raw `PATCH /api/clients/:id/liabilities` request cannot bypass the UI to persist a stale value — Zod rejects the mismatched combination outright and the store is never called. |

This entire table reflects **uncommitted working-tree code** plus one
untracked Drizzle migration (`0013_violet_goblin_queen.sql`) — none of it is
on GitHub or in Production yet. The 2026-08-29 live production audit
(`docs/PRODUCTION_HANDOFF.md` section 4) checked infrastructure state only
and surfaced no new business-rule findings beyond the liabilities
correction above.

## 2026-08-29 Product rebuild (branch `codex-syncash-production-rebuild`)

Uncommitted-at-time-of-writing, then committed on this branch. Not deployed
to Production. Key rule changes:

- **Lender targeting**: the advisor no longer selects companies. `send`/
  `preview` accept no `companyIds` body — the server computes
  `eligibleCompanies()` fresh at send time (every active lender with ≥1
  active contact) and freezes that list into the case version. The advisor
  only ever sees a count (`eligibleCompanyCount`), never names, before a
  company responds.
- **Configurable response deadline**: `system_settings` key
  `response_deadline_business_days` (default 2, integer ≥1) replaces the
  hardcoded 2-business-day constant. `company_submissions.response_business_days`
  snapshots the value used at send time — changing the setting later never
  retroactively changes an existing submission's deadline.
- **Credit indication**: `credit_indications` table (one row per
  client), covering bounced checks/direct debits (with counts),
  collections, bankruptcy, liens, and mortgage arrears for the last 3 years.
  **Updated 2026-08-29**: shown in *both* the masked/initial review (PDF and
  lender-facing page) and the full portal/PDF — the product owner
  explicitly decided this data carries no PII and should be visible before
  a company commits to "Interested", not gated behind it. `MaskedCaseSnapshot`
  carries `creditIndication` through unchanged (`CaseRedactionService` never
  sanitizes it, since it contains no identifying values). It is frozen into
  a case version's `masked_snapshot`/`full_snapshot_encrypted` at send time,
  same as every other snapshot field — a case version sent before this
  change simply has no `creditIndication` key in its stored masked snapshot,
  and that is not "backfilled" from live client data.
- **Required document**: `CREDIT_DATA_REPORT` ("דוח ריכוז נתוני אשראי") is
  now a required per-borrower document, wired through the same
  `REQUIRED_BORROWER_DOCUMENT_TYPES` constant used everywhere else
  (`src/domain/clientFields.ts`) — completeness checks, the upload UI, the
  delivery preflight blockers, and the PDF document-status section all
  derive from that one array.
- **Borrower address**: split into `city` * and `streetAddress` * (both
  required for new records). Legacy records with only the old combined
  `address` field remain valid; the advisor completes city/street on next
  edit. The full lender portal and PDF show both fields separately.
- **Self-employed income model**: `employmentType === "SELF_EMPLOYED"`
  replaces `employerName`/`jobTitle`/`employmentSeniorityYears` with
  business type, business start year, last assessed income, assessment
  year, and two accountant-confirmed income figures (previous/current year,
  labels computed from the real Asia/Jerusalem current year, never
  hardcoded) plus a months-count. Canonically enforced server-side
  (`clientValidation.ts`'s `employmentSchema` transform nulls the
  irrelevant fields regardless of what the client sends).
- **Offer feature removed entirely**: both the legacy pipeline
  (`loan_offers` + the `LenderPortal.tsx` offer button) and the newer
  `company_portal_offers` + `PortalOfferForm` pipeline. No offer UI, API
  route, store method, or type remains; the corresponding tables and enum
  were dropped in migration `0015_woozy_exiles.sql`. Existing offer rows
  were pilot data and were dropped with them (explicit product-owner
  exception to the "don't touch other production data" rule — **applied to
  Production 2026-08-29** as part of the `0af63f4` deploy; see
  `docs/PRODUCTION_HANDOFF.md` section 4).
- **"מוסווה" wording removed everywhere user-facing.** The two-tier
  masked/full disclosure *mechanism* is unchanged — only the word itself
  was replaced (typically with "ראשוני"/"לבחינה ראשונית", and "********"
  for masked placeholder values). A regression test
  (`tests/unit/forbiddenWording.test.ts`) scans all of `src/` for the
  banned fragments, and `scripts/verify-production-bundle.mjs` scans the
  built frontend bundle for the same fragments — both fail the run if any
  survive.
- **Password policy**: `passwordSchema` (`src/domain/advisorRegistration.ts`)
  reduced to a minimum-8-characters check only; the uppercase/lowercase/
  digit/special-character/no-space rules were removed. This is our own
  application-layer Zod schema — no Firebase Console password policy
  configuration was found in this repo, and none was touched.

### Completion pass, same day

The initial rebuild pass above left the full lender portal's section order,
the full PDF's hierarchy, and the typography audit as PARTIAL/SKIPPED, and
E2E as not-run. A same-day follow-up closed all of these — see
`docs/DECISIONS.md` ("Full lender portal rebuilt into distinct sections;
PDF hierarchy rebuilt; typography baseline added" and "Server-determined
lender targeting makes the old two-wave delivery test obsolete") for what
changed, and the `FINAL PRODUCT COMPLETION REPORT` for verification
evidence (a real Playwright run against the local Docker stack, live
portal screenshots at desktop/mobile, generated-PDF visual review, and
migration dry-runs on both a fresh database and the existing local one).

### Deployed to Production, same day

This entire rebuild — including the completion pass above — was deployed
to Production at commit `0af63f4` on 2026-08-29, with migrations `0014`
and `0015` both applied. See `docs/PRODUCTION_HANDOFF.md` section 4 for
the live-verified post-deploy state.

## 2026-08-30 Forgot password, SUPER_ADMIN user management, legal documents

- **Forgot password** (`POST /api/auth/forgot-password`, public,
  rate-limited 2/minute and 5/hour): always returns the identical generic
  message regardless of whether the email belongs to a real, unknown, or
  archived account — the response and timing must never let a caller infer
  account existence. Firebase Authentication generates the actual
  reset link; PostgreSQL never stores a password of any kind.
- **SUPER_ADMIN user management**: edit profile fields (name, phone,
  business name), change email (updates Firebase and Postgres in the same
  operation, resets `emailVerified` to force re-verification), disable/
  enable with an optional recorded reason, archive/restore (soft-delete via
  `users.deletedAt`, never a hard delete, never touches cases/documents/
  audit records), resend verification, and admin-triggered password-reset
  email. No admin action ever sets, displays, or logs a password.
- **Audit events** for all of the above: `USER_UPDATED`,
  `PASSWORD_RESET_REQUESTED_BY_ADMIN`, `EMAIL_VERIFICATION_RESENT`,
  `USER_DISABLED`, `USER_ENABLED`, `USER_SUSPENDED`, `USER_ARCHIVED`,
  `USER_RESTORED` — each with actor, target user, UTC timestamp, and
  request id; never a password or token value.
- **Legal documents** (Terms of Service, Privacy Policy): versioned
  (`DRAFT` → `PUBLISHED` → `ARCHIVED`), SUPER_ADMIN-only to create/edit/
  publish. A published version is immutable — editing always creates a new
  `DRAFT` copied from the currently active version; publishing archives the
  previous active version and computes a SHA-256 content hash. A user's
  historical acceptance always points to the exact version they accepted,
  even after a newer version is published — publishing never retroactively
  affects existing acceptances, and existing users are never forced to
  re-accept (no `require_reacceptance` flag exists yet; a future one could
  be added without a schema change to the acceptance table itself).
  Registration records an acceptance only for a document type that
  currently has a published version, so an unpublished Privacy Policy never
  gets a fabricated acceptance record.

## 2026-08-31 Housing status, loan-purpose OTHER, optional property address, title deed optional, reminder dedup

- **Housing status** (`borrowers.housing_status`: `OWNED`/`RENTED`/`OTHER`,
  plus `housingStatusOther` free text required only when `OTHER`): required
  per borrower for every borrower whose own address is required. For a
  `MARRIED` relationship, only borrower 1 is asked — borrower 2's value is
  copied from borrower 1 server-side before validation runs
  (`canonicalizeMarriedBorrowers`, the same mechanism already used for
  `city`/`streetAddress`), never asked twice in the UI, never required
  independently for borrower 2 via the API. Partners/siblings/other
  relationships keep independent housing status per borrower. Existing
  rows have `housing_status IS NULL` and display as "לא צוין" everywhere
  (PDF, portal, admin) — never blocked from delivery for missing it.
- **Additional-income legacy cleanup**: "שעות נוספות קבועות",
  "בונוסים קבועים", "הכנסה מעצמאות קטנה", "תמיכה משפחתית קבועה" can no
  longer be *selected* for a new case (`SELECTABLE_ADDITIONAL_INCOME_TYPES`
  in `src/domain/clientFields.ts`, enforced server-side only in
  `newClientInputSchema`, the same precedent as the marital-status/
  employment-type legacy cleanup). Existing records keep the value, display
  it, and can still be edited without being forced to change it — the
  per-section `PATCH` schemas were deliberately left unrestricted.
- **Loan purpose OTHER**: `loanPurpose`/`loanPurposeOther` mirror the
  existing `propertyType`/`propertyTypeOtherDescription` OTHER+detail
  pattern exactly — required only when `loanPurpose === "OTHER"`, rejected
  otherwise, shown everywhere the purpose itself is shown.
- **Property street address is optional**: `properties.address_encrypted`
  was already nullable at the DB level; the Zod schemas
  (`clientInputObjectSchema`, `clientPropertyInputSchema`) now accept
  `null`/blank, and `collectDeliveryBlockers()` no longer blocks sending a
  case to lenders over a missing address. Label renamed from "כתובת הנכס"
  to "רחוב ומספר בית" everywhere (form, PDF, portal, admin, the lender
  field-reveal-request label).
- **Title deed (`PROPERTY_RIGHTS`) is no longer a required document**:
  moved from `REQUIRED_CLIENT_DOCUMENT_TYPES` to a new
  `OPTIONAL_CLIENT_DOCUMENT_TYPES` in `src/domain/clientFields.ts` — still
  uploadable, still shown in the document list (as "לא הועלה (אופציונלי)"
  rather than "חסר"), no longer counted in case-completeness or
  send-to-lenders validation. Already-uploaded title deeds are unaffected.
- **Married household data is entered once, after both borrowers**: for a
  `MARRIED` relationship, "נתוני משק הבית" (children count/ages) now renders
  after the borrower-details stack instead of before it, matching how
  partner/other relationships already render it. It was already
  household-level (not duplicated per borrower) before this change — only
  the visual placement moved; the underlying data model was not touched.
- **Lender reminders are exactly one per submission** — see
  `docs/DECISIONS.md` ("Lender reminders made submission-scoped instead of
  per-invitation") for the full root cause and fix. One reminder, one
  recipient (the primary contact, else the oldest open invitation), sent
  once, on Israeli business day 2 at 09:00, gated by
  `company_submissions.reminder_sent_at`.
- **The "Interested" advisor email** now includes: "חברת המימון הביעה
  עניין בתיק. נציג החברה או איש הקשר מטעמה צפוי ליצור איתך קשר בתוך 48
  שעות לצורך המשך הטיפול." — only on the `interested: true` branch, never
  committing the lender to closing the deal, only to making contact.
