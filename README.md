# NEXORA

AI Business Operating System, Malaysia first. M0 includes account sessions, merchant membership, tenant isolation, and role-controlled merchant workflows. Customer and Platform Admin have separate application entry points; M1-A adds tenant-scoped Customer CRM in the Merchant Portal; M1-B adds unified product/service catalogs and public browsing. M1-C adds a transactional merchant order engine. Customer checkout, payments and AI providers remain later modules.

## Workspace

| Application | Directory | Local port |
| --- | --- | --- |
| Customer Portal | apps/customer-web | 3000 |
| Merchant Portal | apps/merchant-web | 3001 |
| Platform Admin | apps/admin-web | 3002 |
| NestJS API | apps/api | 4000 |
| BullMQ Worker | apps/worker | Redis queue nexora |

Shared packages: database (Prisma), auth (scrypt/session cryptography), ui (portal components), shared (CRM contracts) and ai-core (reserved for later implementation).

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

Tests require the local Compose database and Redis. API tests create unique synthetic accounts/merchants and retain test data; they never clear existing data. Acceptance fixtures require local database/Redis targets and use independent Redis rate-counter key prefixes, preserving real authentication limits without flushing developer keys. Browser acceptance uses the compiled API through a test-only startup wrapper with the same rate-counter isolation. Worker tests use a unique test queue. E2E builds into isolated `.next-e2e` directories, starts the compiled API and all three production-built Next.js apps, then stops those test servers. Dedicated ports 3100–3102 and 4100 must be free; development ports 3000–3002/4000 can remain running. `scripts/e2e.mjs` restores the generated normal-build Next declarations afterward. Chromium defaults to `/usr/bin/chromium`; set CHROMIUM_PATH for an installed compatible Chromium elsewhere. Test results and traces stay ignored under test-results; traces can contain session details and must not be committed.

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

## M1-A Customer CRM

Open `/crm` in the Merchant Portal, select a merchant, and use `/crm/new`, `/crm/:customerId` and `/crm/:customerId/edit`. Lists support case-insensitive name/email/phone search, status/tag filters and bounded pagination. Tags normalize to lowercase; optional contact fields can be cleared. Notes and append-only follow-ups are persisted in PostgreSQL; displayed times use Malaysia time.

Owners and Managers may create/edit profiles, tags and notes. All merchant roles may read CRM and add follow-ups. Staff cannot modify core customer profiles. No delete/export endpoint is introduced. CRM contacts are separate from User login identities: matching contact email never grants merchant access. The selected merchant controls navigation, while every API request independently checks membership and uses tenant-scoped database queries. Follow-up/customer relationships additionally use a composite tenant foreign key.

Apply the additive `202611150002_crm` migration only to the intended development database via `pnpm db:migrate`. Never reset data or use production for automated tests. Tests create synthetic contacts and retain them without truncating existing tables.

See [M1 schema and API design](docs/M1-DESIGN.md) for endpoint contracts, limits, the role matrix, identity boundaries and the proposed B/C/D direction. The design records the current catalog implementation and remaining order/storefront direction.

## M1-B Products & services

Merchant `/catalog` supports listing/search/status/type/category filters, create/edit/detail, categories, variants, image management, store publication and a price-list foundation. Owner/Manager can manage; Staff is read-only. Prices are exact decimal strings backed by PostgreSQL Decimal(18,4), with no client float conversions. Item deletion archives and hides the record; existing CRM/accounts are unchanged.

Enable a unique store slug in `/catalog/settings` to make ACTIVE items publicly browsable in Customer Portal `/stores/:slug`. Draft, archived and deleted items remain unavailable through public detail/image URLs. Public DTOs omit SKU, tenant and staff/CRM data. English, Chinese and Malay catalog interfaces are available with a persistent language selector.

Uploads accept decoded PNG/JPEG/WebP up to 2 MiB, re-encode stripped WebP, and enforce pixel/output-size limits plus a transactional ten-image cap. Images are stored as tenant-scoped database bytes for this foundation. No upload directory or file path is exposed.

Apply additive migration `202611150003_catalog` only to the intended development database. PriceList overrides, digital delivery, bundle composition, cart/payment are not implemented. See docs/M1-DESIGN.md for the full fields, API contracts and tested boundaries.

## M1-C Merchant orders

Merchant `/orders`, `/orders/new`, `/orders/:id` and `/orders/:id/edit` provide real catalog/CRM selection, server-priced quotes, draft editing, state management, search/filters and paginated history/audit. English, Chinese and Malay use the shared merchant workspace language selector. Owner/Manager write; Staff read only.

Canonical API prefix is `/api/tenants/:tenantId/orders`. `/api/orders` aliases derive the active merchant from the authenticated session, still checking membership. Create requires `Idempotency-Key`; state/edit requests require the current `version`. Quote and order amounts are always calculated server-side from ACTIVE catalog items and optional active variants. The UI never computes money. One currency per order, 1–100 distinct item/variant lines, integer quantities 1–10000; catalog unit prices remain Decimal(18,4), order totals Decimal(24,4). Discounts and tax are fixed at zero in this foundation; no payment or FX/currency-settlement rounding is claimed.

Orders snapshot item/variant names, SKU and unit prices. Note/contact-only draft edits keep existing price snapshots; explicitly replacing lines recalculates from the current catalog. A quote hash detects catalog changes between preview and create/reprice. Every write is transactional with an audit event. Row locks and mandatory versions prevent lost state updates. Idempotency persists original responses per tenant/actor/key, including concurrent retries; a changed payload with the same key returns conflict.

Draft → Pending/Confirmed/Cancelled; Pending → Confirmed/Cancelled; Confirmed → Processing/Cancelled; Processing → Completed/Cancelled. Completed/Cancelled are terminal. Only Draft permits profile/line edits; explicit state actions are checked by the API.

`GET /api/customer/orders` and `GET /api/customer/orders/:id` form an ownership-filtered read foundation: source CUSTOMER and customerUserId must match the signed-in account. Matching CRM email/contactId or knowing an order ID never grants access. Merchant orders do not automatically attach customer accounts. Customer order creation is documented for future M1-D only and is not exposed; no customer purchase pages, cart, payment or M1-D implementation was added.

Apply additive migration `202611150004_orders` only to the local development DB. It retains existing catalog/CRM data and adds order models, composite references, uniqueness and monetary checks. See docs/M1-DESIGN.md for transaction, concurrency and customer API contracts.
