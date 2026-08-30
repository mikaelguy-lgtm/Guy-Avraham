# SynCash — Open Items

Last synced 2026-08-30 after the Production deployment of `9756fac`
(migration `0017` applied — DPA document type, privacy-requests entity,
Legal Center UI), which superseded the earlier `b419eed` deploy (migration
`0016` — forgot-password, SUPER_ADMIN user management, versioned legal
documents). See `docs/PRODUCTION_HANDOFF.md` section 4/5 for the
live-verified operational state. Only
real, unresolved items — nothing here is a suggestion to refactor or a style
preference. Resolved items are removed rather than archived here; see
`docs/DECISIONS.md` and `docs/PRODUCTION_HANDOFF.md` for the historical record
of what was fixed and when.

## Open questions needing a user decision

1. **Marital status "SEPARATED" and employment types
   "GOVERNMENT_EMPLOYEE"/"SECURITY_FORCES" were not removed** — only demoted
   to legacy-only (blocked for new records, still valid/visible on existing
   records, still in the DB constraints and label maps). See
   `docs/DECISIONS.md` for the open question this raises: is legacy-only
   acceptable, or does "remove" mean a full deletion requiring a data
   migration for existing records that hold these values today?
2. A second local branch, `codex-local-production-rebuild` (`c01e0e3`, "Fix
   advisor email verification and password guidance"), exists locally and
   was not investigated. Confirm with the user whether it's stale or still
   needed before any branch cleanup.
3. Confirm with the user whether the apex-domain migration (`syncash.co.il`
   / `www.syncash.co.il`, still pointing at the legacy server
   `62.219.78.222`) is intentionally deferred indefinitely, and for how long
   — since Brevo's sending-domain authentication (DKIM/DMARC/branded
   subdomain) already lives on that same apex domain today.

## Minor, non-urgent cleanup

4. **Redundant/overlapping SSH `PasswordAuthentication` directives** across
   multiple files in `/etc/ssh/sshd_config.d/` on the production server
   (`00-syncash-hardening.conf`, `50-cloud-init.conf`,
   `60-cloudimg-settings.conf`, `99-temp.conf`, `99-syncash-password.conf`).
   The effective config is correct and live-verified (`syncash`: key +
   password, `root`: blocked), so this is not urgent, but it's confusing for
   whoever reads these files next — worth consolidating into one clear file
   eventually, with explicit user approval before touching `sshd_config.d`
   again.
5. `docker compose -p syncash-prod ls` was observed listing config files
   from two release directories instead of just the current one. Not
   confirmed as a problem — likely benign Compose project-state bookkeeping
   — but worth understanding before it's mistaken for something more
   serious later. Not re-checked since the `3f5685e` deploy.
6. UFW and Fail2ban status have not been re-checked live since the
   2026-07-27 baseline audit (only SSH/Nginx/Docker/backups/disk/RAM have
   been re-verified in the deploys since). No reason to suspect drift.
7. `AUDIT.md` (repo root, dated 2026-07-21) is completely stale — it
   describes an empty/non-functional imported prototype, which bears no
   resemblance to the current, fully-implemented codebase. Recommend
   labeling it clearly as a historical baseline snapshot (e.g. move under a
   `docs/history/` folder or add a banner) so a future session doesn't
   mistake it for current state.
8. `codex-bridge/` directory (per `AUDIT.md`, described as unrelated
   workspace tooling, out of SynCash scope) — left untouched, not audited.

## Open from the 2026-08-29 product rebuild completion pass

Items 9–14 from the first rebuild pass (portal section order, PDF hierarchy,
typography, E2E execution, visual verification, notification scoping) were
all closed out in a follow-up completion pass the same day — see
`docs/DECISIONS.md` ("Full lender portal rebuilt into distinct sections; PDF
hierarchy rebuilt; typography baseline added" and "Server-determined lender
targeting makes the old two-wave delivery test obsolete") for what changed
and why, and the corresponding `SYNCASH PRODUCT REBUILD REPORT` / `FINAL
PRODUCT COMPLETION REPORT` for the verification evidence (real E2E run
against the local Docker stack, live screenshots, generated-PDF visual
review, migration dry-runs). Two residual, genuinely minor items remain:

9. **Typography: only a global h1–h4 baseline plus a few explicitly
   named elements were fixed** (company name, advisor name — via a new
   `.prominent-name` class — and the `.eyebrow` kicker size). Metadata
   labels throughout the app that were already below the 14px floor before
   this pass (timestamps, small hints, badges outside the five audited
   surfaces) were not individually raised — the rebuild spec only required
   this "as much as possible" and explicitly forbade a blind global
   font-size increase, so a narrower, hierarchy-driven fix was made instead
   of touching every small label in the app.
10. **"Authorized managers" notification scoping** still has no concept to
    verify against in this codebase (only single-advisor targeting exists).
    The product owner has since clarified (2026-08-29) that this is not a
    blocker for the current task — no manager notification system needs to
    be built. Revisit only if a manager role/notification concept is
    introduced later.

## Open from the 2026-08-29 Production deploy of `0af63f4`

11. **Pre-migration row counts for `clients`/`borrowers`/`documents`/
    `company_submissions` were not captured** before migration `0015` ran
    (only the two offer tables' counts were, per the explicit deploy
    instruction). Post-deploy counts are non-zero and plausible, and the
    migration is structurally incapable of touching those tables (see
    `docs/DECISIONS.md`), but there is no literal before/after count proof
    on record for them. Not urgent — just noted so a future incident
    investigation doesn't assume that comparison exists.
12. **`response_deadline_business_days` has no explicit row in Production's
    `system_settings`** — the code correctly falls back to the hardcoded
    default of 2, so behavior is unaffected, but the setting was never
    actually exercised end-to-end in Production (only its fallback path
    was). Left unset deliberately, per the explicit "don't change the
    Production setting right now" instruction — revisit only if the
    business wants a different default.

## Discovered 2026-08-29 running the full E2E suite (pre-existing, unrelated to that day's credit-indication/PDF-filename fixes)

13. **Six E2E spec files are stale against the `0af63f4` portal/address-split
    rebuild and currently fail**: `external-borrower-layout.spec.ts` (all 9
    viewport/scenario variants — expects a single `external-borrowers-full`
    test id, but the full portal was split into four separate sections
    `external-borrowers-personal`/`-income`/`-additional-incomes`/`-liabilities`
    as part of that rebuild), `multi-borrower.spec.ts` (fills a single
    "כתובת מגורים" field that no longer exists — address is now split into
    "עיר מגורים"/"רחוב ומספר בית"), plus `advisor-registration.spec.ts`,
    `advisor-visual.spec.ts`, `client-delivery.spec.ts`,
    `client-edit-navigation.spec.ts` (not yet individually root-caused).
    Confirmed via `git log` that none of these spec files have been touched
    since commit `3f5685e`, which predates the `0af63f4` rebuild entirely —
    this is pre-existing test debt, not a regression from any later change.
    `full-flow.spec.ts` (the spec most relevant to credit indication and PDF
    generation) was fixed and passes. The other six need a dedicated pass to
    update their selectors/assertions to the current UI before they can be
    trusted again.

## Open from the 2026-08-30 forgot-password / SUPER_ADMIN / legal-documents phase

15. **Privacy Policy now has real content, drafted but not yet published** —
    superseded by the 2026-08-30 legal-suite phase: a full 21-section
    Privacy Policy and an 18-section DPA were drafted
    (`scripts/seed-legal-drafts-v2.ts`), along with a `TERMS` v2 draft
    updating the lender-targeting/versioning language. All three are
    `DRAFT`, none published — `GET /api/legal-documents/PRIVACY` and
    `/DPA` correctly 404 in Production. A SUPER_ADMIN needs to review each
    draft in Settings → Legal Documents and decide when to publish. Phone
    and address are still `[להשלמה]`-equivalent (left `null`, not
    fabricated) — the publish-confirmation modal warns about this for
    non-TERMS documents, but does not block publishing.
16. **Local Docker dev containers (`newproject-api-1`, `newproject-frontend-1`)
    needed a manual `docker compose restart` during this phase** before newly
    added routes/UI were reachable, despite the bind-mounted source already
    being current and `tsx watch`/Vite HMR normally picking up changes live —
    observed only after the containers had been running ~19 hours across many
    file edits. Not a code bug (confirmed: the exact same code worked
    immediately after the restart, and this class of container never affects
    Production, which always starts fresh containers on deploy). Worth
    remembering for future long-running local sessions: if a brand-new route
    or component 404s/fails to load locally despite the source looking
    correct, restart the dev containers before assuming a code defect.

## Open from the 2026-08-30 Legal Center / DPA / privacy-requests phase

17. **Publishing `TERMS` v2 is a business decision, not made in this phase**
    — it would archive the currently-accepted v1 and change what new
    registrants must accept. The v2 draft (id 3 in Production) is ready
    for SUPER_ADMIN review but was deliberately left unpublished, matching
    the earlier phase's rule not to unilaterally change what users must
    accept.
18. **Legal-entity company number `000000000` is a placeholder** used inside
    the drafted Privacy Policy body text (not a structured field) — flagged
    in the admin Legal Documents banner ("פרט זמני — יש לעדכן לפני השקה
    מסחרית") but not shown to end users in the document itself, per the
    explicit instruction. Needs a real company number before any of the
    three drafts (Terms v2, Privacy, DPA) are published commercially.
