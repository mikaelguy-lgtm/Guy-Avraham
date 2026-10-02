# SynCash Production Server Audit

Audit date: 2026-07-27

Server: `169.58.83.2` (`vmi3469016.contaboserver.net`)

Scope: dedicated SynCash production host

## System

- Ubuntu 24.04.4 LTS, kernel `6.8.0-124-generic`, KVM virtualization.
- 8 vCPU, 23 GiB RAM, 4 GiB encrypted-host swap file, approximately 288 GiB free disk.
- Root filesystem is ext4; inode usage was 1% at audit time.
- Time synchronization is active; timezone was changed from Europe/Berlin to Asia/Jerusalem.
- Initial load was effectively idle and no production application was present.

## Existing Applications

No existing applications, Docker projects, databases, volumes, reverse-proxy sites, certificates, PM2 processes, or custom systemd application services were found. The host is dedicated to SynCash.

## Ports

Before preparation, only SSH port 22 was listening publicly. After baseline preparation:

- `22/tcp`: OpenSSH, public, key authentication only, user `syncash` only.
- `80/tcp`: Nginx HTTP entry point.
- `443/tcp`: reserved in UFW for Nginx HTTPS after certificate issuance.
- `3180/tcp`: reserved for SynCash frontend, bound to `127.0.0.1` only.
- `3181/tcp`: reserved for SynCash API, bound to `127.0.0.1` only.
- PostgreSQL, Redis, MinIO API, and MinIO Console have no host port mappings.

## Docker

- Docker Engine `29.6.2` and Docker Compose `v5.3.1` were installed from Docker's official Ubuntu repository.
- No pre-existing containers, images, networks, volumes, or Compose projects were present.
- Planned project: `syncash-prod`.
- Planned networks: `syncash-prod-internal` and `syncash-prod-edge`.
- Planned volumes: `syncash-prod-postgres-data`, `syncash-prod-redis-data`, `syncash-prod-minio-data`.
- No `container_name`, host networking, privileged containers, source bind mounts, or public database/object-storage ports are used.

## Nginx and TLS

- Nginx `1.24.0` and Certbot `2.9.0` are installed.
- No prior custom server blocks or TLS certificates existed.
- The SynCash server block is isolated at `/etc/nginx/sites-available/app.syncash.co.il.conf`.
- TLS issuance is blocked until `app.syncash.co.il` resolves to `169.58.83.2`.

## Firewall and SSH

- UFW is active with inbound access limited to OpenSSH, HTTP, and HTTPS.
- Fail2ban is active for SSH.
- A dedicated `syncash` deployment user was created and separately verified before hardening.
- Effective SSH settings: `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PubkeyAuthentication yes`, `AllowUsers syncash`.
- The private SSH key was never read, copied, changed, or placed in an environment file.

## DNS

- `syncash.co.il` resolves to `62.219.78.222` and was not changed.
- `www.syncash.co.il` resolves to `62.219.78.222` and was not changed.
- `app.syncash.co.il` had no A/AAAA/CNAME record at audit time.
- Required record: A, host `app`, value `169.58.83.2`, TTL 300 or provider default.
- Do not create an AAAA record until IPv6 routing and firewall behavior are explicitly validated.

## Capacity Decision

The host exceeds the minimum capacity gate. The isolated production plan leaves substantial CPU, memory, disk, and inode headroom and does not require reuse of any existing service, port, database, network, or volume.
