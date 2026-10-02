# SynCash

SynCash is a secure financing workflow for mortgage advisors and non-bank lenders. Advisors manage clients and documents, create strictly anonymous lender submissions, and approve granular identity disclosures. Authenticated lender users review cases assigned to their company and submit replies or financing offers.

## Local start

1. Install Node.js 24 and Docker Desktop.
2. Copy `.env.example` to `.env` and fill every required local value.
3. Generate an encryption key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
4. Start the stack: `docker compose up -d`.
5. Run migrations: `docker compose exec api npm run db:migrate`.
6. Seed development identities: `docker compose exec api npm run db:seed`.

Local services:

- Web: `http://localhost:5173`
- API: `http://localhost:3000`
- Firebase Auth emulator: `http://localhost:9099`
- Mailpit: `http://localhost:8025`
- MinIO console: `http://localhost:9001`

## Quality commands

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
npm audit
```

See `LOCAL_DEVELOPMENT.md`, `ARCHITECTURE.md`, and `SECURITY.md` for the complete workflow and security model.
