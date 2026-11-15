# NEXORA

AI Business Operating System, Malaysia first. M0 includes account sessions, merchant membership, tenant isolation, and role-controlled merchant workflows. Customer and Platform Admin have separate application entry points; M1 business features and AI providers are not implemented.

## Workspace

| Application | Directory | Local port |
| --- | --- | --- |
| Customer Portal | apps/customer-web | 3000 |
| Merchant Portal | apps/merchant-web | 3001 |
| Platform Admin | apps/admin-web | 3002 |
| NestJS API | apps/api | 4000 |
| BullMQ Worker | apps/worker | Redis queue nexora |

Shared packages: database (Prisma), auth (scrypt/session cryptography), ui (portal components), shared and ai-core (reserved for later implementation).

## Development

Use Node.js 22+ and pnpm 10.32.1. From the existing checkout:

1. Copy `.env.example` to `.env` only if `.env` does not already exist. Set a strong local PostgreSQL password and the matching DATABASE_URL. Never commit `.env`.
2. `pnpm install --frozen-lockfile`
3. `docker compose up -d` and `docker compose ps` (PostgreSQL and Redis must be healthy).
4. `pnpm db:generate`
5. `pnpm db:migrate` (uses migrate deploy; never resets data).
6. `pnpm dev` starts the API, worker and three portals. Root development/database/test scripts load `.env`; standalone API and worker also load the repository `.env` without overriding injected variables.

Cloud tasks are isolated: use the existing checkout, and do not create worktrees unless requested. In this managed machine the default pnpm command points at a different global version, so configure the pinned executable and writable storage before commands:

```sh
export XDG_DATA_HOME=/workspace/.nexora-tools/data
export XDG_CACHE_HOME=/workspace/.nexora-tools/cache
export COREPACK_HOME=/workspace/.nexora-tools/corepack
corepack prepare pnpm@10.32.1 --activate
mkdir -p /workspace/.nexora-tools/bin
ln -sf /workspace/.nexora-tools/corepack/v1/pnpm/10.32.1/bin/pnpm.cjs /workspace/.nexora-tools/bin/pnpm
export PATH=/workspace/.nexora-tools/bin:$PATH
```

The symlink is outside the repository and points only to the pinned package manager. TLS and checksum verification must remain enabled. Do not delete Compose volumes or reset a database.

## Validation

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, then `pnpm test:e2e`.

Tests require the local Compose database and Redis. API tests create unique synthetic accounts/merchants and retain test data; they never clear existing data. Worker tests use a unique test queue. E2E starts the compiled API and all three production-built Next.js apps, then stops those test servers. Ports 3000–3002 and 4000 must be free. Chromium defaults to `/usr/bin/chromium`; set CHROMIUM_PATH for an installed compatible Chromium elsewhere. Test results and traces stay ignored under test-results; traces can contain session details and must not be committed.

`GET /api/health` verifies PostgreSQL and Redis. `GET /api/health/live` is process liveness only.

## Access model

- Registration creates an ordinary user and an opaque HttpOnly SameSite=Lax session. Only a digest is stored in PostgreSQL; logout revokes the database session. Login rotates the current session. Sessions expire after seven days.
- A new merchant grants its creator OWNER. Owners can add existing registered users as MANAGER or STAFF. Ownership transfer and invitations are outside M0.
- All roles can view their own merchant Dashboard. OWNER and MANAGER can rename their merchant and view its members. Only OWNER can add members. Each API operation checks authenticated membership; tenantId in a request never grants access.
- Platform permission is separate from merchant roles. Ordinary signup cannot grant platformAdmin. No default admin account or seeded password exists. An authorized operator can promote a specific existing user through a reviewed database administration process; the integration test exercises this only for its own synthetic test user and restores the flag.
- Mutating requests require X-Nexora-Request: 1 and, when an Origin is supplied, an exact allowed origin. Browser apps use same-origin /api proxying; the API does not enable cross-origin credentials.
- Authentication rate limits use Redis, keyed by client address and normalized email. Forwarded IP headers are not trusted by default.

For deployment configure HTTPS, COOKIE_SECURE=true, NODE_ENV=production, explicit ALLOWED_ORIGINS, DATABASE_URL and REDIS_URL. API_INTERNAL_URL selects the private API destination for portal proxying at build time. Local development shares a host cookie across the three ports; separate deployment hosts require a reviewed session/cookie-domain policy. Deployment, external identity, email verification, password recovery, MFA, audit trails and business/AI modules are outside this M0 acceptance.

See VALIDATION.md for historical checkpoints and the latest verified results.
