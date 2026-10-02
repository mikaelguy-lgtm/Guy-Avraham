# Dynamic SMTP Configuration

## Incident Finding

The Production save failure identified in the UI as request `4081…` was an API `500` with the sanitized server code `UNHANDLED_REQUEST_ERROR`.

The root cause was confirmed through the runtime identity permissions on `syncash-smtp-password`:

- Secret version access: available.
- Secret version creation: unavailable.
- Secret metadata read: unavailable.
- Secret version disable: unavailable.

The previous implementation called `GoogleSecretManagerProvider.setSecret()` when a new SMTP password was submitted. That method required permissions the runtime Service Account did not have, and the route allowed the resulting provider error to reach the generic error handler. Saving non-secret settings worked; saving a replacement password failed before the PostgreSQL update.

## Storage Model

Non-secret settings are stored in `email_configurations`:

- Provider, host, port and connection security mode.
- SMTP username, sender address, sender name and reply-to address.
- Lifecycle status, test timestamps, activation timestamps and rollback link.
- Secret name and immutable version reference only.

SMTP credentials remain in the configured `SecretProvider`. Secret values are never stored in PostgreSQL, returned by the API, written to audit metadata or logged.

## Lifecycle

1. Saving creates a `DRAFT` configuration and leaves the active configuration unchanged.
2. A real SMTP verification and test email moves the draft to `TESTED`.
3. Only a `TESTED` configuration can become `ACTIVE`.
4. Activation marks the prior configuration as `SUPERSEDED` and preserves it for rollback.
5. A failed test marks only the draft as `FAILED`; the current active configuration continues serving email.
6. Rollback atomically restores the previous configuration.

## Runtime Loading

The API and Worker query the active configuration at runtime. No process restart is required after activation or rollback. Environment SMTP values remain a bootstrap fallback only when no versioned configuration exists.

The Worker checks activation before reading the email outbox. With no active configuration, email jobs remain pending without attempts or retries while non-email schedules continue.

## Security Controls

- All configuration endpoints require `SUPER_ADMIN`.
- SMTP tests are rate limited.
- Production custom SMTP hosts reject localhost, private networks, link-local addresses, metadata endpoints and internal host suffixes.
- Production custom SMTP ports are restricted to approved SMTP ports.
- Gmail and Brevo presets enforce port 587 with STARTTLS.
- Error responses contain only a sanitized code, Hebrew message and request ID.
- Password replacement creates a new secret version. A blank field preserves the referenced version.
- Password removal clears the draft reference and does not modify the active configuration.

## API Endpoints

- `GET /api/admin/settings/email`
- `PATCH /api/admin/settings/email`
- `DELETE /api/admin/settings/email/:id/password`
- `POST /api/admin/settings/email/:id/test`
- `POST /api/admin/settings/email/:id/activate`
- `POST /api/admin/settings/email/rollback`
- `GET /api/email/status`

## Production Permission

The runtime Service Account requires secret-level permission to add versions to `syncash-smtp-password` in addition to its existing version-access permission. It does not require secret listing, version listing, secret deletion or project-wide secret administration.
