# M1 business design

Base: develop at 9ebf44e3352fc412bbf682888d3d32849f2e070f. Implementation branch: feature/m1-core-business. M1-A is complete. The M1-B checkpoint adds catalog management and public catalog preview. M1-C/D remain design direction, not implemented features.

## Identity and tenant boundary

Keep M0 User, Membership and opaque sessions. CRM Customer represents a merchant contact, not a login identity or an employee. No matching an email address may grant staff membership or customer-order access. Every authenticated business endpoint rechecks membership for the path tenant; client body/query tenant identifiers never override it. All new business tables have a physical tenant_id column; child records use composite tenant/parent foreign keys. Do not change existing M0 migrations or tenant identifiers.

## M1-A schema

Customer: id, tenant_id, name (1–120), email (optional, <=254), phone (optional, <=40), status (LEAD/ACTIVE/INACTIVE), tags (<=10, normalized lowercase, <=32 each), notes (<=4000), created_at, updated_at. Index tenant/created/id, tenant/status and GIN tags. Contacts are intentionally not globally unique: different merchants may hold the same contact, and contact data grants no account access.

CustomerFollowUp: id, tenant_id, customer_id, author_id (authenticated User), content (1–2000), occurred_at (server time), created_at. Composite (tenant_id, customer_id) references Customer(tenant_id, id); author is derived from the session. Records are append-only. No customer deletion, bulk export, or destructive data cleanup in A.

## M1-A API

All paths start /api/tenants/:tenantId/customers.

| Method | Suffix | Purpose |
| --- | --- | --- |
| GET | / | List with q, status, tag, page (default 1), pageSize (default 20, maximum 100); return items, total, page, pageSize, totalPages. Stable newest-first order with id tie-breaker. |
| POST | / | Create name/contact/status/tags/notes; tenant supplied only by authorized route. |
| GET | /:customerId | Scoped contact detail, 404 for an ID outside that tenant. |
| PATCH | /:customerId | Partial update of allowed customer fields only. |
| GET | /:customerId/follow-ups | Paginated, scoped immutable history with safe author identity. |
| POST | /:customerId/follow-ups | Append content; tenant, customer, author and timestamps are server-controlled. |

Unknown body/query fields and malformed pagination are rejected. JSON objects only, bounded values, normalized email/tags, no markup rendering. Authentication/CSRF/session controls remain unchanged. List/count queries use a repeatable-read transaction. CRM is unavailable on the Customer and Admin portals, and platformAdmin alone does not grant merchant contact access.

| Action | Owner | Manager | Staff |
| --- | --- | --- | --- |
| List/search/filter/view | Yes | Yes | Yes |
| Create/edit contact, tags and notes | Yes | Yes | No |
| Read/append follow-up | Yes | Yes | Yes |
| Delete contact/follow-up | No endpoint | No endpoint | No endpoint |

Merchant routes: /crm, /crm/new, /crm/:customerId, /crm/:customerId/edit. Tenant switching clears prior data and navigation context. Handle loading, empty, validation/error and unauthorized states; mobile cards and bounded pagination. All displayed records come from the API.

## Later module direction

B: implemented using exact Decimal(18,4) prices as specified by the M1-B requirements; see the detailed contract below. No floating-point price conversion.

C: Order, OrderLine and state transition history scoped by tenant, with composite product/contact references. Future implementation must validate catalog items and quantities, calculate exact totals with an explicit currency-rounding policy, snapshot unit prices/currency, and enforces a unique tenant/customer/idempotency-key constraint with request digest mismatch rejection. Customer order ownership uses authenticated User, never matching CRM email.

D: explicitly published merchant profile/hours and catalog routes plus mobile storefront checkout. Public browsing exposes no CRM contacts. Customer self-service orders are authorized by account ownership; staff access remains separately membership-scoped.

## Migration and validation

Only additive migrations on the verified local Compose PostgreSQL database. No production database operations, table resets, volume deletion or overwrites. Unit validation tests, real PostgreSQL integration tests including composite foreign key rejection and every role/tenant boundary, browser workflow tests, and all M0 regression tests precede module commit/push. Run lint, typecheck, test and build for every completed module. Preserve historical VALIDATION.md entries and report exact outcomes.

## M1-B catalog schema and precision

All five new business models have physical tenant_id columns. CatalogItem supports PRODUCT, SERVICE, DIGITAL and BUNDLE; the latter two reserve type boundaries only, with no fulfillment/download or composition engine. Fields: id, tenantId, name (160), description (6000), itemType, optional normalized uppercase SKU (64), currencyCode, basePrice Decimal(18,4), status DRAFT/ACTIVE/ARCHIVED, optional categoryId, timestamps and deletedAt. Deletion is a soft tombstone: catalog queries hide the record and its media; SKU remains reserved.

CatalogCategory has normalized lowercase name (100) and timestamps. Unique (tenant_id,name) and (tenant_id,id) constraints. Items reference categories by composite (tenant_id,categoryId); category deletion conflicts if any item, including a soft-deleted one, still references it.

CatalogVariant has tenantId, itemId, name (100), optional uppercase SKU, Decimal(18,4) price and active flag. Composite item reference prevents cross-tenant association; unique (tenant_id,itemId,name), (tenant_id,sku) and (tenant_id,id). Item and variant SKU namespaces are separately tenant-scoped. Variant currency inherits its item; changing item currency is blocked while variants exist to avoid silently relabeling variant prices.

CatalogMedia has tenantId, itemId, canonical WebP bytes, mimeType, size, width, height, altText (160) and createdAt. Composite item relation prevents cross-tenant assets. JSON selects metadata only; binary content is served from guarded media endpoints. Local PostgreSQL byte storage is the initial implementation, not a claim of object-store/CDN deployment.

PriceList provides tenant-scoped name, currencyCode, active flag and timestamps; unique (tenant_id,name) and (tenant_id,id). List/create APIs and UI are provided as a foundation. Entries, overrides, discounts and price resolution are not implemented or applied; public prices are the item and active variant prices.

Prices are nonnegative decimal strings at input, persisted as Decimal(18,4), and returned with four fractional digits. Numeric JSON, exponent notation, excessive precision/length and negative values are rejected. Database CHECK constraints independently reject negative item/variant prices. Supported currencies: MYR, SGD, USD, EUR, GBP, AUD, CNY, JPY, IDR, THB, BND, INR, KRW, TWD, HKD, VND, PHP, NZD, AED, SAR. This is a unit-price catalog, not settlement rounding or FX conversion.

Tenant adds nullable catalog_slug and catalog_public=false. Public slug must be globally unique for unambiguous URL routing; it is a routing identifier, while catalog business uniqueness includes tenant scope. Existing tenants are private by default; no backfill publishes their data.

## M1-B API

Private prefix: /api/tenants/:tenantId/catalog. Every private endpoint checks session/member access; only Owner/Manager may mutate. Staff can view items, categories, images, store settings and price-list metadata. Upload guards execute before multipart parsing. Existing M0 session, CSRF/origin and rate-limit mechanisms are retained.

| Method | Suffix | Contract |
| --- | --- | --- |
| GET/POST | /items | Paginated list/create. List supports q, status, itemType, categoryId, page, pageSize (max 100). New items default to DRAFT. |
| GET/PATCH/DELETE | /items/:id | Scoped detail/update/soft delete. Unknown body fields are rejected. |
| GET/POST | /categories | List/create categories. |
| PATCH/DELETE | /categories/:id | Rename/delete unused category, returning conflict when referenced. |
| POST | /items/:id/variants | Create a name/SKU/price/active variant. |
| PATCH/DELETE | /items/:id/variants/:variantId | Scoped variant changes/removal. |
| POST | /items/:id/media | Multipart file + optional altText; returns sanitized metadata only. |
| GET/DELETE | /items/:id/media/:mediaId | Authenticated image read/removal. |
| GET/PATCH | /store | Read/update {slug,published}; validates slug and exact boolean. |
| GET/POST | /price-lists | Tenant-scoped foundation list/create. |

Public prefix: /api/public/stores/:slug. No login is required, and no merchant membership is inferred.

| Method | Suffix | Contract |
| --- | --- | --- |
| GET | / | Explicit public merchant name/slug only; unavailable stores return 404. |
| GET | /items | Same bounded pagination; q/itemType/categoryId only. Only ACTIVE, nondeleted items. |
| GET | /items/:id | Active public detail only, including active variants. |
| GET | /media/:id | Only media of an ACTIVE, nondeleted item in this published store. |

Public DTO allowlist: id, name, description, itemType, currencyCode, basePrice, category id/name, active variant id/name/price, sanitized media metadata. No SKU, tenant identifiers, status/deletion fields, inactive variants, raw media bytes, CRM contacts, memberships or account data in public JSON. Unpublishing a store or archiving/deleting an item denies direct detail/media URLs as well as listing.

## M1-B upload security and UI

Exactly one file and at most one metadata field; 2 MiB input maximum. Declared PNG/JPEG/WebP MIME must match decoded content. Sharp performs full decoding with a 16-million-pixel budget, rejects animation/corruption, strips metadata and re-encodes canonical WebP at maximum 1600×1600, with 1 MiB encoded maximum. SVG, arbitrary text, MIME spoofing, corrupt/truncated bytes, oversized uploads and decompression-size excess are rejected. User filenames are never storage paths. Maximum 10 images per item, enforced in a transaction serialized by a tenant-scoped parent row lock. Response uses image/webp, nosniff and a restrictive media CSP.

Merchant routes: /catalog, /catalog/new, /catalog/:itemId, /catalog/:itemId/edit, /catalog/categories, /catalog/settings. Catalog pages and public components offer English, Simplified Chinese and Malay, stored as a browser language preference. Amounts display exact strings, not floats. Layouts adapt to mobile and desktop.

Customer routes: /stores/:slug and /stores/:slug/items/:itemId. PublicCatalog is a reusable component backed entirely by real API data. It is a browsing preview only: no cart, checkout, payments or M1-C implementation.

Acceptance isolation: API and browser fixtures require loopback PostgreSQL/Redis and refuse production mode. Test-only Redis clients use unique key prefixes; production Data/authentication code and limit thresholds remain unchanged. A real HTTP/Redis regression test verifies that twenty invalid-email login attempts are accepted for checking and the twenty-first is rejected with 429. No Redis database or keys are flushed.
