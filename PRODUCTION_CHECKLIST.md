# SynCash Production Checklist

## Code Gate

- [ ] Branch is `codex-syncash-production-rebuild` and worktree is clean.
- [ ] Unit, integration, E2E, typecheck, lint, and build pass.
- [ ] Production bundle contains no localhost, emulator, Mailpit, or private secret identifiers.
- [ ] No real `.env`, credentials, private keys, customer documents, or E2E data are tracked.
- [ ] Remaining upstream npm advisories are resolved or formally accepted after reviewing actual runtime reachability.

## Server Gate

- [x] Dedicated `syncash` user verified before SSH hardening.
- [x] Root and password SSH login disabled; key-only `syncash` login verified afterward.
- [x] UFW, Fail2ban, Nginx, Certbot, Docker Engine, and Compose installed.
- [x] Timezone, clock synchronization, swap, disk, RAM, and ports verified.
- [x] Baseline backup created before server changes.

## External Configuration Gate

- [ ] `app.syncash.co.il` A record points to `169.58.83.2`.
- [ ] Firebase Production web configuration supplied.
- [ ] Firebase Authorized Domain includes `app.syncash.co.il`.
- [ ] Google Secret Manager ADC credential installed with mode `0600`.
- [ ] Required Secret Manager secret names exist.
- [ ] Real SMTP server, sender, reply-to, SPF, DKIM, and DMARC are configured.

## Deployment Gate

- [ ] Production environment file is complete, mode `0600`, and contains no development endpoints.
- [ ] `docker compose config --quiet` passes.
- [ ] Pre-deploy encrypted backup passes.
- [ ] SHA-tagged images build successfully.
- [ ] PostgreSQL, Redis, and MinIO become healthy without public ports.
- [ ] Production SecretProvider check passes.
- [ ] Database migrations pass exactly once.
- [ ] API, worker, and frontend become healthy.
- [ ] Nginx configuration test and reload pass.
- [ ] TLS certificate and renewal dry run pass.
- [ ] Encrypted backup and isolated restore test pass.
- [ ] Production smoke tests pass without real customer data.
- [ ] Rollback procedure is verified and previous release is recorded.

## Opening Gate

Do not open SynCash to users until every unchecked external and deployment item is complete. A frontend shell without real Firebase/API/SMTP connectivity is not considered a Production deployment.
