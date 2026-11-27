# Backup and Restore

## Scope

Back up PostgreSQL and the private MinIO bucket together. PostgreSQL contains document metadata and storage keys; MinIO contains the corresponding bytes. Keep encryption keys and secret-manager configuration in a separate protected recovery process.

Redis contains rate-limit and temporary data and does not require durable business-data recovery.

## PostgreSQL backup

```bash
docker compose exec -T postgres pg_dump -U syncash -d syncash --format=custom > syncash-postgres.dump
```

Encrypt the dump before off-host transfer. Record the application commit and migration journal with every backup.

## MinIO backup

Use the MinIO client from a controlled administrative workstation:

```bash
mc alias set syncash http://localhost:9000 "$S3_ACCESS_KEY_ID" "$S3_SECRET_KEY"
mc mirror --overwrite syncash/syncash-documents ./syncash-documents-backup
```

Encrypt the mirrored files and preserve checksum metadata.

## Restore drill

1. Stop API writes.
2. Create an empty PostgreSQL database and empty private bucket.
3. Restore PostgreSQL with `pg_restore --clean --if-exists --no-owner`.
4. Restore the MinIO mirror.
5. Restore the matching field-encryption key and service secrets through the approved secret provider.
6. Run `npm run db:check` and migration status checks.
7. Verify synthetic clients, document checksums, anonymous PDFs, lender ownership, and audit-log continuity.
8. Resume traffic only after security and application checks pass.

Never test restoration with real customer data in an uncontrolled development environment.

