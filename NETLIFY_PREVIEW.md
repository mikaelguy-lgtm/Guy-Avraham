# Netlify Deploy Preview

Netlify hosts only the SynCash frontend. A working preview requires an externally reachable staging API and a public Firebase web application configuration.

## Required public variables

Configure these values in the Netlify Deploy Preview context:

```text
VITE_API_BASE_URL
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_USE_FIREBASE_EMULATOR=false
```

`VITE_API_BASE_URL` must be an absolute externally accessible HTTP or HTTPS URL. It must not reference a local Docker service. Firebase emulator mode is rejected in preview and production builds.

Do not configure server-side credentials with a `VITE_` prefix. Database URLs, SMTP credentials, encryption keys, Firebase private credentials, S3 or MinIO credentials, and Google Secret Manager credentials must remain backend-only.

When the staging API or Firebase public configuration is absent, the preview intentionally renders a Hebrew configuration screen. It does not emulate API success or use local fallbacks.
