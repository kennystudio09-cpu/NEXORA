# M1 business design

Base: develop at 9ebf44e3352fc412bbf682888d3d32849f2e070f. Implementation branch: feature/m1-core-business. M1-A is complete. The M1-B checkpoint adds catalog management and public catalog preview. M1-C implements the transactional merchant order engine and customer ownership-filtered read foundation. M1-D remains design direction, not implemented.

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

C: implemented as Order/OrderItem, history/audit and actor-scoped idempotency; see the detailed contract below. Customer ownership uses authenticated User, never a CRM email match.

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

## M1-C order schema

All five new models have physical tenant_id columns; child records reference Order(tenant_id,id) with restrictive composite foreign keys.

- Order: id, tenantId, tenant-unique orderNumber, optional tenant-scoped CRM contactId and contactNameSnapshot, optional customerUserId, createdById, source MERCHANT/CUSTOMER/AI/APPOINTMENT, status, currencyCode, Decimal(24,4) subtotal/discountTotal/taxTotal/grandTotal, notes (4000), version (starts at 1), createdAt and updatedAt. Merchant API sets source MERCHANT; AI/APPOINTMENT are reserved and cannot be supplied by clients. No automatic customer identity assignment from CRM contacts or emails.
- OrderItem: tenantId/orderId/position, catalogItemId, optional catalogVariantId, itemNameSnapshot, variantNameSnapshot, skuSnapshot, Decimal(18,4) unitPriceSnapshot, integer quantity and Decimal(24,4) lineTotal. Unique tenant/order/position. Composite catalog and variant references ensure a variant belongs to the selected item and tenant. Adding OrderItem references makes deletion of a referenced catalog variant conflict, preserving historical references; catalog item soft deletion leaves snapshots readable.
- OrderStatusHistory: tenant/order, authenticated actorId, nullable initial fromStatus, toStatus, version, reason (1000), createdAt. Unique tenant/order/version. No mutation endpoint.
- OrderEvent: tenant/order, actorId, type CREATED/UPDATED/STATUS_CHANGED, version, bounded structured JSON payload and timestamp. Unique tenant/order/version. Draft update payloads contain before/after snapshots; status payloads contain from/to/reason. No mutation endpoint.
- IdempotencyKey: tenant/actor/key, requestHash, tenant-scoped orderId, original JSON response and createdAt. Unique tenant/actor/key. Keys persist with orders; no expiry silently permits duplicate creation. JSON key ordering is not part of response semantics.

Order numbers are cryptographically random NXR-prefixed identifiers, not a sequential counter; tenant-scoped database uniqueness is authoritative. The migration adds a composite unique index to CatalogVariant(tenant_id,itemId,id) for correct variant/order-item relationships. Existing migrations/data are preserved.

## M1-C pricing and transactions

Create accepts contactId, items [{catalogItemId,catalogVariantId?,quantity}], notes, optional initialStatus DRAFT/PENDING and optional server quoteHash. Unknown fields, tenantId, source, customerUserId, currency, client prices, totals, tax and discount inputs are rejected. Only ACTIVE, nondeleted catalog items and active matching variants are selectable. All lines must share one currency; quantities are integers 1–10000, at most 100 distinct item/variant lines. Duplicate lines are rejected rather than double-counted implicitly.

The server locks selected catalog/variant rows for shared reads, looks up the CRM contact in the same tenant, captures names/SKU/unit prices, multiplies and sums using a Decimal clone with precision 40, and serializes exact four-place strings. Wide precision avoids default 20-significant-digit rounding. Totals use Decimal(24,4), with a strict bound below 10^20. No JavaScript floating-point money arithmetic. Discounts/taxes are zero for this foundation; no tax engine, FX, payment capture or currency settlement-rounding feature. Database checks enforce nonnegative totals, zero unsupported adjustments, balance, positive versions, bounded quantity and exact unit-price × quantity line totals.

Quote is read-only and returns a fingerprint of its server-resolved terms. Create/reprice can require the same quoteHash to detect changed terms; the fingerprint is not a price authorization token and never replaces server lookups. Draft note/contact-only edits preserve prices. Replacing lines explicitly refreshes snapshots; prior revisions remain in immutable audit JSON.

Creation transaction: parse/canonicalize request → acquire transaction advisory lock for tenant/actor/key → check stored request hash → return original response if identical → resolve current prices/contact → insert Order and lines → initial history and audit → persist original idempotency response → commit. A different payload for the same key conflicts. Failed transactions leave no partial order/key/audit. Read Committed is used with the lock so a waiting retry sees the first committed response, avoiding an older repeatable-read snapshot. Concurrent identical requests create one order and one initial event/history.

Mutation transaction: tenant-scoped Order row lock → verify expected version → validate state/edit rule → write version+1 and changes → append history for status changes and an audit event for every change → commit. Racing actions with the same expected version have one winner; the other returns 409 without another event. Retrying a state action with an old version conflicts and causes no duplicate effect. No order deletion endpoint.

| From | Allowed next states |
| --- | --- |
| DRAFT | PENDING, CONFIRMED, CANCELLED |
| PENDING | CONFIRMED, CANCELLED |
| CONFIRMED | PROCESSING, CANCELLED |
| PROCESSING | COMPLETED, CANCELLED |
| COMPLETED/CANCELLED | None |

Only DRAFT can edit lines/contact/notes. State transitions cannot be combined with draft edits in one PATCH. Confirm/complete/cancel are explicit actions, and completed/cancelled records are locked.

## M1-C merchant API

Canonical prefix `/api/tenants/:tenantId/orders`; alias `/api/orders` uses the authenticated session's active tenant. Both check current membership, not supplied body/query tenantId. Owner/Manager may mutate; Staff reads. Sessions, CSRF headers/origin validation and tenant isolation remain unchanged.

| Method | Suffix | Contract |
| --- | --- | --- |
| POST | /quote | Read-only server quote from actual catalog/contact; returns snapshots, sums and quoteHash. |
| POST | / | Create with Idempotency-Key header (8–128 bounded ASCII characters). Same request/key returns original response, including after later edits. |
| GET | / | Page/pageSize(max100), q(order number/contact snapshot), status, source, contactId. Stable newest-first results. |
| GET | /:id | Scoped order/snapshots, notes, status and current version. |
| PATCH | /:id | Version + draft fields, or version/status=PENDING or PROCESSING/reason. No arbitrary terminal status assignment. |
| POST | /:id/confirm | Version/reason; target CONFIRMED, validated against current status. |
| POST | /:id/cancel | Version/reason; target CANCELLED, validated against current status. |
| POST | /:id/complete | Version/reason; target COMPLETED, requires PROCESSING. |
| GET | /:id/history | Paginated status history with safe actor id/email; ordered by version. |
| GET | /:id/events | Paginated immutable audit entries; same tenant authorization. |

Initial POST succeeds with 201, including idempotent replay; changed-payload key reuse, stale quote/version and invalid business transitions return 409. Invalid shape/price injection returns 400. Nonmembers receive 403; a member using an order ID outside the selected tenant receives 404.

Merchant UI: `/orders`, `/orders/new`, `/orders/:id`, `/orders/:id/edit`. Real catalog/variant and CRM selectors include server searches beyond initial option pages; all summaries use server quote/snapshot strings. New orders reuse the same client idempotency key for identical retry payloads and disable in-flight submit controls. Draft note-only changes preserve prices; user-requested recalculation/replacement refreshes terms. Existing selections missing from current option pages are explicitly labeled saved snapshots. State/history/audit and mobile layout use English/Chinese/Malay labels. No mock business data is embedded.

## Customer ownership foundation and future M1-D contract

Implemented `GET /api/customer/orders` (page/pageSize/status) and `GET /api/customer/orders/:id` require a current session and filter source CUSTOMER plus customerUserId equal to session.userId. A bare ID, matching CRM email/contact or merchant ownership does not grant this customer read path. No cross-account override/filter is accepted. Customer DTO exposes order number, status, currency/totals/timestamps and item name/variant/unit-price/quantity/line-total snapshots; it omits merchant notes, SKU, tenant/contact/account identifiers and actor/audit data. Private merchant history remains membership-only. Positive read authorization is tested with explicitly seeded local database fixtures, not a claim of a live checkout flow.

Designed but not exposed: `POST /api/customer/stores/:slug/orders` in M1-D. It must require authenticated customer identity, a published slug, ACTIVE public catalog/variants, server-derived tenant/prices and the same transactional/idempotency engine. Set source CUSTOMER and customerUserId from the session, initial status PENDING; never accept employee roles, arbitrary contactId, customerUserId, source or final amounts. CRM linking needs a reviewed explicit ownership mapping, not email guessing. Query remains the implemented ownership-filtered path. Payment/checkout pages, cart and customer creation endpoint are not implemented in M1-C.
