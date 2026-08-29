# SynCash — Architecture Decisions

Compiled 2026-08-28 from repo history/reports. New entries should be appended
with a date and a short "why", not just a "what".

## Release artifacts must be byte-stable regardless of local autocrlf (2026-08-29)

**Decision**: `.gitattributes` explicitly forces `eol=lf` for every source/
config/migration file type (`*.sh`, `*.sql`, `*.ts`, `*.tsx`, `*.js`, `*.mjs`,
`*.cjs`, `*.json`, `*.yml`, `*.yaml`, `*.md`, `*.conf`, `Dockerfile*`), plus a
`* text=auto eol=lf` fallback. `scripts/build-release-artifact.sh` builds
every Production release directly from Git's object database and verifies
each file's content against its Git blob hash before ever producing the
artifact. `deploy-production.sh` independently asserts no `.sh`/`.sql` file
in the release contains a CRLF byte, before any other deploy work.

**Why**: building the `3f5685e` release on a Windows machine with global
`core.autocrlf=true` silently converted the (previously LF-only-covered)
migration SQL and most other tracked files to CRLF during `git archive` —
producing an artifact that was byte-different from what had just passed the
full test suite. It was caught only by a manual `sha256sum` comparison
against `git show HEAD:...` before upload, not by any automated gate. Since
`.gitattributes` only had an `eol=lf` rule for `*.sh`, nothing protected
`.sql`/`.ts`/etc. This is now fixed at the root (Git itself normalizes on
checkout/archive, independent of any machine's config) with two additional,
independent layers of defense so a similar mistake can never again reach
Production without failing loudly first. No application/business logic
changed as part of this fix — see `docs/PRODUCTION_HANDOFF.md` section 8 for
full detail, `docs/SECURITY_MODEL.md` for the production-safety framing, and
`tests/unit/releaseArtifactIntegrity.test.ts` for the regression tests.

One implementation note worth remembering: `git hash-object` **re-applies**
Git's clean filter (CRLF → LF) by default, which would silently mask exactly
the corruption this check exists to catch. The verification script must pass
`--no-filters` to get the true on-disk byte content. Caught by testing
against a deliberately corrupted file before trusting the check.

## PostgreSQL as sole business-data authority

**Decision**: No JSON store, no localStorage-as-authority, no automatic demo
fallback. Everything — clients, documents metadata, submissions, OTPs,
sessions — lives in PostgreSQL.

**Why**: The very first audit of this codebase (`AUDIT.md`, 2026-07-21) found
an imported prototype with empty backend files, fabricated liability values,
and role-based decryption with no ownership checks. The full rebuild
deliberately eliminated every implicit/local data path so authorization can
always be re-checked server-side against a single source of truth.

## Firebase = identity only, never authorization

**Decision**: Every protected request re-loads role/status/ownership from
PostgreSQL; Firebase claims are never trusted for access control.

**Why**: Same root cause as above — client-controlled or token-only trust
was the class of bug found in the initial audit (`mapDbClientToFrontend()`
letting any `ADVISOR` decrypt PII with no ownership check).

## Dynamic SMTP configuration (Draft → Test → Activate → Rollback)

**Decision**: SMTP provider/credentials live in Postgres
(`email_configurations`) + a Secret Manager version reference, resolved at
runtime by API and Worker — never an env var requiring redeploy.

**Why**: A prior incident (`SMTP_DYNAMIC_CONFIGURATION.md`) traced a
Production save failure to `GoogleSecretManagerProvider.setSecret()`
requiring permissions the runtime service account lacked, with the failure
surfacing as a generic sanitized `500`. The fix both corrected the
permission model (grant only "add secret version", not full secret admin)
and moved provider swaps out of the deploy pipeline entirely, so a future
provider change (e.g. leaving Brevo) never requires SSH/deploy/restart.

## Single-OTP lender portal flow (2026-08-01)

**Decision**: `POST /api/external/review/:token/interested/verify` is the
single transition point that finalizes the decision, activates the
disclosure grant, and opens the authenticated portal session in one step.

**Why**: The previous two-step flow (interest verification, then a separate
access-link verification) forced lender contacts through a second email and
a second OTP just to reach the portal they'd already unlocked. This was a
friction/UX defect, not a security one — session/grant boundaries were
unchanged; only the number of round-trips was reduced.

## Legacy-value handling for restricted enum options (marital status,
employment type) — needs confirmation, not yet a settled decision

**Current implementation** (uncommitted, in progress): values slated for
removal (`SEPARATED` marital status; `GOVERNMENT_EMPLOYEE`,
`SECURITY_FORCES` employment types) were **not deleted**. Instead they were:
excluded from the selectable dropdown for new records, rejected by Zod for
new submissions, but still valid on existing records (both to display and to
leave unchanged on edit), and still present in the DB `CHECK` constraints
and label maps.

**Open question for the user**: is "legacy-only, never selectable again but
still viewable/editable-in-place on historical cases" an acceptable reading
of "remove", or does the requirement mean these values must not exist at
all — which would require a data-migration decision for any existing
records currently holding them? See `docs/TODO.md` item on this. Until
answered, treat the current in-progress code as *a* reasonable interpretation,
not a confirmed match to the stated requirement.

## Financial-institution field on liabilities gated to LOAN/MORTGAGE (2026-08-29)

**Decision**: The free-text "גוף פיננסי" field on a liability is shown and
required only for `LOAN` and `MORTGAGE`, and is forced to `null` (hidden,
not collected) for `ALIMONY` and `RENT`. This is confirmed as the correct,
final behavior — not a bug.

**Why this entry exists**: the 2026-08-28 handoff audit pass misread the
original brief and reported this as "wired backwards," concluding the field
should instead apply to `ALIMONY`/`RENT`. The user corrected this on
2026-08-29: the field is meant for identifying which bank/finance company
issued a loan or mortgage (free text, e.g. "בנק הפועלים", "MAX" — no closed
dropdown), and has no meaning for alimony or rent, which is exactly what the
existing code already implemented. No code change was made; only the
documentation record was wrong and has been corrected in
`docs/BUSINESS_RULES.md` and `docs/TODO.md`. Recorded here as a reminder to
verify a requirement against the user directly before flagging existing,
working code as a defect.

## Dev-period password SSH fallback for `syncash`, alongside the key (2026-08-29)

**Decision**: during the current development period, the `syncash` account
on the production server keeps both `PublicKeyAuthentication yes` (primary)
and `PasswordAuthentication yes` (fallback), scoped to `syncash` only via a
`Match User syncash` block — not a global setting. `root` remains fully
blocked (`PermitRootLogin no`, `AllowUsers syncash`). The password is stored
locally on the operator's machine only, outside any repository
(`C:\Users\guyav\.syncash\credentials.env`, Windows-ACL-restricted to the
current user), read only by a local wrapper script
(`connect-syncash.ps1`) that tries the SSH key first and never places the
password on a command line, in shell history, or in a process list.

**Why**: the user's explicit, standing instruction for the development
period, so that a tool (Claude Code, Codex, or otherwise) failing to use the
SSH key doesn't block work on re-entering a password every time. The user
was clear this is a temporary, explicit choice — not a general relaxation of
security posture — and that it does **not** extend approval to any other
sensitive category (IAM, DNS, UFW, Fail2ban, root SSH, global Nginx/Docker
daemon config, destructive DB operations, merges/force-pushes), all of which
still require per-instance explicit approval regardless of how SSH access
was obtained. At end of the development period, the user intends to rotate
the password and decide whether to return to key-only auth.

## Liability-type change must null out type-specific fields (2026-08-29)

**Decision**: switching a liability's type must reset `financialInstitution`
and `currentBalance` to `null`/empty whenever the new type doesn't use them,
rather than leaving a stale value from the previous type in place.

**Why**: confirmed by the user as an explicit requirement (not just a nice
UX touch) — e.g. a liability entered as `LOAN` with an institution and
balance, then changed to `RENT`, must not retain the old institution/balance
in the database. Already implemented at two independent layers
(`ClientFormFields.tsx:47` in form state, `clientForm.ts:201` in the payload
builder), so the requirement is satisfied for the standard UI flow. Whether
the API layer independently enforces this against a raw/partial `PATCH` is
still open — see `docs/TODO.md`.

## Lender targeting becomes fully server-determined; the offer feature is removed (2026-08-29)

**Decision**: the advisor no longer picks which lender companies receive a
case. `send`/`preview` no longer accept a `companyIds` list at all — the
server always targets every currently-active lender with ≥1 active contact,
computed fresh at send time and frozen into that case version
(`PostgresLenderDeliveryService.eligibleCompanies()`). Separately, the
entire offer-submission feature (both the legacy `loan_offers` pipeline and
the newer `company_portal_offers` pipeline) was removed end-to-end — UI,
API routes, store methods, types, and the underlying tables/enum
(migration `0015_woozy_exiles.sql`).

**Why**: explicit, final product-owner decision (not a proposal) delivered
as part of a 97-section rebuild spec. The stated intent for lender
targeting is to stop advisors from being able to hand-pick or exclude
specific lenders (a fairness/process-integrity concern), and to remove the
UI/mental burden of a selection step that no longer reflects how the
business wants submissions distributed. The offer feature was explicitly
called out as out of scope for the current product ("offers are a separate
authenticated endpoint" language in the old `BUSINESS_RULES.md` no longer
applies) — existing offer rows were pilot data, and their deletion was an
explicit, one-time exception granted by the product owner to the general
"don't touch other production data" rule.

**How to apply**: never reintroduce a company-selection UI or a
`companyIds`/`lenderIds` request field on the delivery endpoints without a
new explicit product decision — the current contract (server picks, count
only, frozen at send) is intentional, not a placeholder. Do not resurrect
an offer-creation endpoint (lender-side or external-portal-side) without
the same kind of explicit sign-off; the portal is view/decision-only by
design now.

## "מוסווה" family wording is banned from all user-facing surfaces; the redaction mechanism is not (2026-08-29)

**Decision**: every occurrence of מוסווה/מוסווית/מוסווים/מוסוות/הסוואה/להסוות
was removed from UI, PDFs (titles, section headers, footers), emails, and
notifications — replaced with neutral terms ("ראשוני"/"לבחינה ראשונית") or,
for masked placeholder values, a literal `********`. The underlying
two-tier disclosure mechanism (masked initial review → OTP → full portal)
and its `CaseRedactionService` are unchanged; only the word was banned, not
the privacy protection it described.

**Why**: explicit product-owner instruction, framed as zero-tolerance —
"the wording caused confusion/discomfort for lender-side reviewers" was the
stated business reason. A dedicated regression test
(`tests/unit/forbiddenWording.test.ts`, scanning `src/`) and a
build-time bundle scan (`scripts/verify-production-bundle.mjs`, scanning
the built `dist/` output) both fail on any reintroduction of these
fragments, so this should never silently regress.

**How to apply**: when adding any new masked/redacted-view copy, use
"ראשוני" (preliminary) or describe the two-tier flow directly ("שלב
ראשוני"/"תצוגה מלאה") — never any word from the banned family, even as an
internal-sounding variant. Internal-only identifiers (variable/column
names never rendered to a user) are exempt.
