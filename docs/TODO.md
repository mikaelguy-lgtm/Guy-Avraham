# SynCash — Open Items

Last synced 2026-08-29 after the Production deployment of `3f5685e` (migration
`0013` applied) and the CRLF release-artifact hardening that followed. Only
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

## Open from the 2026-08-29 product rebuild (branch `codex-syncash-production-rebuild`)

9. **Full lender portal is not yet reordered into the exact 11-part literal
   sequence** from the rebuild spec. All 11 pieces of information are
   present (advisor, financing/property summary, financial/family summary,
   credit indication, borrower details, income, additional incomes,
   liabilities, property, deal description, documents, full PDF/ZIP), but
   borrower details/income/additional incomes/liabilities are still
   rendered as one consolidated `ExternalBorrowersSection` rather than four
   separate top-level sections in the specified order. Needs a follow-up
   pass through `src/components/ExternalDeliveryPortal.tsx` and
   `ExternalBorrowerDetails.tsx`.
10. **`src/services/pdf.ts`'s full-case PDF was not rebuilt for hierarchy** —
    the forbidden-wording fixes, self-employed/credit-indication field
    additions, and per-borrower document-type wiring landed, but the
    broader visual reorganization (borrower sections with age directly
    beside the name throughout, income grouped per-borrower with numbered
    additional incomes, liability blocks kept together across page breaks)
    was not attempted. Needs dedicated PDF layout work plus visual
    inspection of the rendered output (RTL, page breaks, no orphan
    headings) — not just text-content assertions.
11. **Typography hierarchy audit not done.** Company name and advisor name
    are still visually small in a few surfaces (noted directly in the
    rebuild spec); a full pass through `src/index.css` establishing a
    consistent scale was not attempted in this session.
12. **Playwright E2E was updated for known text/flow changes but not
    executed.** `tests/e2e/full-flow.spec.ts` was patched to match the new
    wizard (no company checkboxes, no confirmation checkbox, new success
    heading) based on reading `LoanArena.tsx`, but this session had no
    running Postgres/Redis/MinIO/SMTP stack to actually run
    `npm run test:e2e` against. Needs a real run before this is trusted —
    other parts of the spec that touch client creation (address split,
    self-employed fields, credit indication) were not audited line-by-line
    and may still reference the old single `address` field or omit
    `selfEmployed`.
13. **Visual/screenshot verification not performed** for any of the 11
    views called out in the rebuild spec (wizard steps, confirmation,
    success, credit indication tab, self-employed form, company responses,
    initial lender view, full lender portal, limited PDF, full PDF) at
    desktop or mobile — no browser was driven against a live instance in
    this session.
14. **Notification scoping to "the owning advisor + authorized managers"**
    was confirmed for the advisor half (`insert into notifications` targets
    exactly one `user_id`, the owning advisor — not a broadcast) but this
    session found no separate manager-notification path to verify the
    "authorized managers" half against; confirm whether that concept exists
    in this product at all before treating it as a gap.
