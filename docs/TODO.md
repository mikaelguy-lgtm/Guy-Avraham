# SynCash — Open Items

Compiled 2026-08-28 during the initial handoff audit, updated 2026-08-29
after the first live production audit. Only real, unresolved items —
nothing here is a suggestion to refactor or a style preference.

## Resolved

- ~~Production SSH access blocker~~ — **RESOLVED 2026-08-29.** The
  `syncash_prod` key was installed to `authorized_keys` and confirmed
  working (`ssh syncash-prod whoami` → `syncash`). A password fallback is
  also live (confirmed via effective `sshd -T -C user=syncash`), scoped to
  `syncash` only, root still fully blocked. Every "not independently
  verified" item from the 2026-08-28 pass has now been live-checked — see
  `docs/PRODUCTION_HANDOFF.md` sections 4 and 6, and `docs/SERVER_MAP.md`.
- ~~"הגוף הפיננסי" field on liabilities is wired backwards~~ — **CORRECTED
  2026-08-29, this was an audit error, not a code defect.** The user
  confirmed the final requirement is the opposite of what the 2026-08-28
  pass concluded: the "גוף פיננסי" free-text field must show for
  `LOAN`/`MORTGAGE` and stay hidden/null for `ALIMONY`/`RENT` — which is
  exactly what the current code already does. No code change needed. See
  `docs/BUSINESS_RULES.md` and `docs/DECISIONS.md` for the corrected record.

## New findings from the 2026-08-29 live audit

1. **API logged a burst of 3× `UNHANDLED_REQUEST_ERROR` at 2026-08-29
   06:52:40 UTC** (09:52:40 IDT), all three within 19ms of each other,
   `requestId: undefined` on all three. Nothing before or since in the 24h
   log window checked. Not investigated further in this pass (would require
   reading more log context / correlating with real traffic, which wasn't
   done to stay read-only and minimal). Worth a targeted look: is this a
   scanner/bot hitting 3 malformed/unrouted paths at once (most likely,
   given the clustering and `requestId: undefined` suggesting the request
   never reached the ID-assigning middleware), or a real, reproducible bug?
2. **Redundant/overlapping SSH `PasswordAuthentication` directives** across
   multiple files in `/etc/ssh/sshd_config.d/` (`00-syncash-hardening.conf`,
   `50-cloud-init.conf`, `60-cloudimg-settings.conf`, `99-temp.conf`,
   `99-syncash-password.conf`). Today's effective config is correct and
   live-verified (`syncash`: key+password, `root`: blocked), so this is
   **not urgent and was not touched**, but it's confusing for whoever reads
   these files next — worth consolidating into a single clear file
   eventually, with explicit user approval before touching `sshd_config.d`
   again.
3. **`docker compose -p syncash-prod ls` lists config files from two
   release directories** (current `9e87b89...` and an older `b1cb13b...`)
   instead of only the current one. Not confirmed as a problem — likely
   benign Compose project-state bookkeeping — but worth understanding
   before it's mistaken for something more serious later.
4. UFW and Fail2ban status were **not** re-checked live in this pass
   (only SSH/Nginx/Docker/backups/disk/RAM were). No reason to suspect
   drift, just not yet re-confirmed against the 2026-07-27 baseline audit.

## Git / release hygiene

5. **GitHub does not reflect what's running in Production.** Local
   `codex-syncash-production-rebuild` is 3 commits ahead of
   `origin/codex-syncash-production-rebuild`, and 2 of those 3
   (`c3ad17f`, `9e87b89`) were already deployed straight to Production per
   `PRODUCTION_DEPLOYMENT_REPORT.md` — live-confirmed 2026-08-29 that
   `9e87b89` is still the active release, and that the 3rd unpushed commit
   (`d2af618`, docs-only) has no release directory at all, i.e. was never
   deployed. Needs a decision from the user on pushing these to origin (no
   action taken — pushing/merging requires explicit approval per repo
   rules).
6. **Working tree is not clean.** 31 modified tracked files plus 2
   untracked Drizzle migration files
   (`drizzle/0013_violet_goblin_queen.sql`,
   `drizzle/meta/0013_snapshot.json`) represent real in-progress work
   implementing part of the section-33 requirements (dynamic income array,
   rent liability type, Torah-institution employment type, legacy-value
   handling for marital status/employment). This has not been committed,
   migrated anywhere, or deployed. Do not discard it; it needs to be
   finished, tested, and committed as a deliberate next step.
7. A second local branch, `codex-local-production-rebuild` (`c01e0e3`,
   "Fix advisor email verification and password guidance"), exists and was
   not investigated in this pass. Confirm with the user whether it's stale
   or still needed before any branch cleanup.

## Section 33 requirement gaps (see `docs/BUSINESS_RULES.md` for full
evidence table)

8. **Marital status "SEPARATED" and employment types
   "GOVERNMENT_EMPLOYEE"/"SECURITY_FORCES" were not removed** — only
   demoted to legacy-only (blocked for new records, still valid/visible on
   existing records, still in the DB constraints and label maps). See
   `docs/DECISIONS.md` for the open question this raises: is legacy-only
   acceptable, or does "remove" mean a full deletion requiring a data
   migration for existing records that hold these values today?
9. **Minor, low-priority**: the DB-level `liabilities_balance_relevance_check`
   (`src/db/schema.ts:231`) only names `RENT` for "current balance must be
   null"; the application-level Zod validation
   (`src/domain/clientValidation.ts:66,68-69`) additionally covers
   `ALIMONY`. Not currently exploitable (app validation runs first and the
   payload builder already sends `null` for both types), but worth aligning
   the DB constraint for defense-in-depth whenever this migration is
   finalized.
10. **Confirm defense-in-depth for liability type changes via raw API.** The
    UI already resets `financialInstitution`/`currentBalance` to `null`
    correctly when the liability type changes — both in form state
    (`ClientFormFields.tsx:47`, `updateType`) and independently in the
    payload builder (`clientForm.ts:201`, `liabilityPayload`), which decides
    both fields from the final selected type regardless of stale form state.
    Not yet specifically verified: whether the API update endpoint requires
    a complete liability object per record (so a type change always
    overwrites institution/balance) or would accept a partial `PATCH` that
    changes only `type` and leaves a stale `financialInstitution`/
    `currentBalance` in the database. Worth a targeted check (and a test)
    before this migration ships, not before.

## Documentation hygiene

11. **`AUDIT.md` (repo root, dated 2026-07-21) is now completely stale** —
    it describes an empty/non-functional imported prototype, which bears no
    resemblance to the current, fully-implemented codebase. Recommend
    labeling it clearly as a historical baseline snapshot (e.g. move under
    a `docs/history/` folder or add a banner) so a future session doesn't
    mistake it for current state. Not renamed/moved in this pass since that
    wasn't explicitly requested.
12. Confirm with the user whether the apex-domain migration
    (`syncash.co.il` / `www.syncash.co.il`, still pointing at the legacy
    server `62.219.78.222`) is intentionally deferred indefinitely, and for
    how long — since Brevo's sending-domain authentication (DKIM/DMARC/
    branded subdomain) already lives on that same apex domain today.

## Not evaluated in this pass (flagged, not investigated)

- UFW / Fail2ban live status (see item 4 above).
- `codex-bridge/` directory (per `AUDIT.md`, described as unrelated
  workspace tooling, out of SynCash scope) — left untouched, not audited.
