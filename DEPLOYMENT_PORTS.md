# SynCash Production Ports

| Port | Bind | Component | Exposure |
| --- | --- | --- | --- |
| 22/tcp | `0.0.0.0`, `[::]` | OpenSSH | Public, key-only, `syncash` user |
| 80/tcp | `0.0.0.0`, `[::]` | Host Nginx | Public HTTP and ACME |
| 443/tcp | `0.0.0.0`, `[::]` | Host Nginx | Public HTTPS after certificate issuance |
| 3180/tcp | `127.0.0.1` | Frontend container | Host-local reverse-proxy target |
| 3181/tcp | `127.0.0.1` | API container | Host-local reverse-proxy target |
| 5432/tcp | Docker internal network | PostgreSQL | Not published |
| 6379/tcp | Docker internal network | Redis | Not published |
| 9000/tcp | Docker internal network | MinIO API | Not published |
| 9001/tcp | Docker internal network | MinIO Console | Not published |

Mailpit, Firebase Emulator, Vite, Playwright, and test service ports are not present in Production.
