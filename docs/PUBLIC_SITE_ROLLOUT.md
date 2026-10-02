# syncash.co.il — Public site rollout runbook

Status (2026-09-26): code, Docker image and host-nginx vhost are ready. The
public site is served by the existing `frontend` container on a second
server block (`127.0.0.1:3182 → 8081`). It is **not reachable from the
internet until two manual, approval-gated steps are done**: the apex/www DNS
change and the host-nginx vhost + certificate. Nothing below touches
`app.syncash.co.il`.

## 1. DNS — what exists today (verified 2026-09-26, `dig`)

| Record | Today | Needed for the public site |
| --- | --- | --- |
| `syncash.co.il` A | `62.219.78.222` (LiveDNS parking; answers HTTP 500, HTTPS resets — nothing useful is served) | `169.58.83.2` |
| `www.syncash.co.il` A | `62.219.78.222` (same parking page) | `169.58.83.2` |
| `app.syncash.co.il` A | `169.58.83.2` | unchanged |
| NS | `park1/park2.livedns.co.il` | unchanged (DNS stays managed at LiveDNS) |
| MX | `mx1/mx2.improvmx.com` | unchanged (mail forwarding keeps working) |
| TXT (`brevo-code`, SPF/DKIM/DMARC for Brevo, `send.` subdomain) | present | unchanged — Brevo transactional mail depends on them |

Impact of changing only the two A records: the parking page (HTTP 500)
is replaced by the SynCash public site; mail, DKIM/DMARC and the app are
unaffected. Propagation: LiveDNS TTL (typically 1h–24h). Rollback: point
the two A records back to `62.219.78.222`.

**Do not change DNS without the owner's explicit instruction.** (CLAUDE.md
rule; also the instruction for this task.)

## 2. Host nginx + certificate (after DNS points here)

The vhost is versioned at `nginx/syncash.co.il.conf`. Installing it is a
host-nginx change and therefore needs explicit approval before running.

```bash
# on the server, as root (or with sudo)
# 1) HTTP-only first (ACME challenge + redirect), because the cert does not exist yet
sudo cp /opt/syncash/current/nginx/syncash.co.il.conf /etc/nginx/sites-available/syncash.co.il.conf
#    temporarily keep ONLY the first `server { listen 80 ... }` block enabled
#    (comment the two 443 blocks) until step 3 has produced the certificate
sudo ln -s /etc/nginx/sites-available/syncash.co.il.conf /etc/nginx/sites-enabled/syncash.co.il.conf
sudo nginx -t && sudo systemctl reload nginx

# 2) confirm DNS + ACME path
dig +short syncash.co.il www.syncash.co.il        # both must return 169.58.83.2
curl -I http://syncash.co.il/.well-known/acme-challenge/test   # 404 from nginx, not a parking page

# 3) issue the certificate (webroot is /var/www/certbot, same as the app)
sudo certbot certonly --webroot -w /var/www/certbot -d syncash.co.il -d www.syncash.co.il

# 4) enable the two 443 blocks, test, reload
sudo nginx -t && sudo systemctl reload nginx

# 5) verify
curl -I https://syncash.co.il/                 # 200, HSTS/CSP headers, no X-Robots-Tag
curl -I https://www.syncash.co.il/             # 308 -> https://syncash.co.il/
curl -I http://syncash.co.il/                  # 308 -> https://syncash.co.il/
curl -s https://syncash.co.il/robots.txt
curl -s https://syncash.co.il/sitemap.xml | head
curl -s https://syncash.co.il/api/public/site-settings
curl -I https://syncash.co.il/api/health       # 404 (only the 3 public endpoints are proxied)
```

Certbot's existing systemd timer renews all certificates on the host,
including this one.

## 3. Google Search Console (manual, needs the owner's Google account)

1. Add a **Domain** property `syncash.co.il` (DNS TXT verification at
   LiveDNS) — or a URL-prefix property `https://syncash.co.il/` verified
   by uploading the HTML file Google provides into
   `marketing/src/static/` (commit + redeploy) — no token was invented.
2. Submit `https://syncash.co.il/sitemap.xml`.
3. Confirm `app.syncash.co.il` stays out of the index: it already sends
   `X-Robots-Tag: noindex, nofollow` from the host nginx and now also has
   `<meta name="robots" content="noindex, nofollow">` in `index.html`.

## 4. Local QA commands

```bash
npm run build:marketing                                  # -> marketing/dist
node marketing/serve-dev.mjs 4180 http://localhost:3000  # static + proxy of the 3 public endpoints
node scripts/qa-marketing-site.mjs http://127.0.0.1:4180 <outDir>   # screenshots 1440/1366/390/360 + SEO + privacy audit
node scripts/qa-public-site-settings.mjs http://127.0.0.1:5173 http://127.0.0.1:4180 <outDir>
node scripts/generate-favicons.mjs && node scripts/generate-og-image.mjs   # regenerate brand assets from the logo
```
