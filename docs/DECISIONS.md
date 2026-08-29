# SynCash — Architecture Decisions

Compiled 2026-08-28 from repo history/reports. New entries should be appended
with a date and a short "why", not just a "what".

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
