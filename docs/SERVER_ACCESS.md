# SynCash — Production server access

Last updated: 2026-11-26. **No passwords, private keys or tokens belong in this file.**

## Current production server

| Item | Value |
| --- | --- |
| Provider | Contabo GmbH |
| Contabo account | `guy.avrahaam@gmail.com` (customer ID `INT-13923538`) — the same account as the main server `vmi2604496` / `173.212.193.59` |
| Instance | `vmi3791333` — Cloud VPS 4 (2026): 4 vCPU, 8 GB RAM, 100 GB SSD, region EU |
| Billing | Monthly term, ~$8.60/month incl. Contabo **Auto Backup** ($2.00/month), ordered 2026-11-26 |
| Public IPv4 | `77.216.129.137` |
| OS | Ubuntu 24.04.5 LTS |
| SSH host key (ED25519) | `SHA256:LbddixregMLffIJ/HZ36lg1iWtB7flFKnFdU2Ey4grY` — if SSH ever reports a different key, STOP (see "Incident 2026-11" below) |

## How to connect

SSH key only, as the deploy user **`syncash`** (member of `docker`, passwordless `sudo`).
The key pair lives on Guy's machine:

- Private key: `C:\Users\guyav\.ssh\syncash_prod` (never copy, never commit)
- Public key: `C:\Users\guyav\.ssh\syncash_prod.pub` (`ssh-ed25519 … syncash-prod-20260829`)
- Alias in `C:\Users\guyav\.ssh\config`: `Host syncash-prod` → `syncash@77.216.129.137`

```powershell
ssh syncash-prod            # interactive shell
ssh syncash-prod "docker ps" # one command
```

SSH hardening (`/etc/ssh/sshd_config.d/00-syncash-hardening.conf`, verified 2026-11-26):
`PasswordAuthentication no`, `PermitRootLogin no`, `AllowUsers syncash`. Root and password logins
over SSH are refused. Use `sudo` for root work.

The **root password** chosen at order time is kept by Guy only (password manager). It is not
stored anywhere in the repo or in chat; it now works only on the Contabo web console (VNC) for
emergencies.

## Base setup (2026-11-26)

- Timezone `Asia/Jerusalem`; kernel `6.8.0-151`; unattended security upgrades on.
- Firewall `ufw`: only 22, 80, 443 inbound. fail2ban active. 4 GB swap.
- Docker 29 + Compose v2, nginx 1.24, certbot 2.9.
- App root `/opt/syncash` (`releases/`, `shared/env`, `shared/secrets`, `shared/logs`,
  `shared/locks`, `backups/`), owned by `syncash`; ACME webroot `/var/www/certbot`.

Emergency access if the SSH key is lost: Contabo Control Panel → VPS `vmi3791333` → VNC console
(root password), or Contabo "Reset password" / "Reinstall" (reinstall wipes the server).

## Incident 2026-11 (why this server exists)

The previous server `vmi3469016` / `169.58.83.2` (Cloud VPS 8, provisioned 2026-07-27) was
**cancelled by Contabo on 2026-11-08**: the 27.10 renewal (€14) was not paid, a reactivation fee
was booked on 28.10, and the service was terminated. The IP was then reassigned to another
customer (it now serves Caddy with a different SSH host key — never connect to it again).
Contabo Auto Backup was **not** enabled and all backups lived on the same disk, so the data was
lost. Production data was demo/test only, so the system is being rebuilt from Git.

Lessons applied: Auto Backup enabled at order time; off-server encrypted backups; a working
payment method checked monthly.

## DNS (LiveDNS, managed by Guy)

`syncash.co.il`, `www.syncash.co.il`, `app.syncash.co.il` → A records must point at
`77.216.129.137`. MX (ImprovMX), Brevo TXT/DKIM/DMARC records must never be touched.
