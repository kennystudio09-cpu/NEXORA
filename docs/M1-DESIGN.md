# M1 business design

Base: develop at 9ebf44e3352fc412bbf682888d3d32849f2e070f. Implementation branch: feature/m1-core-business. This checkpoint implements M1-A only; B/C/D are design direction, not implemented features.

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

## Later module direction (not implemented in A)

B: tenant-scoped CatalogItem (PRODUCT/SERVICE), Category, integer minor-unit price, ISO currency, publish status, tenant-bound image asset metadata and validated uploads. Public catalog exposes published fields only.

C: Order, OrderLine and state transition history scoped by tenant, with composite product/contact references. Server validates catalog items and quantities, calculates integer totals, snapshots unit prices/currency, and enforces a unique tenant/customer/idempotency-key constraint with request digest mismatch rejection. Customer order ownership uses authenticated User, never matching CRM email.

D: explicitly published merchant profile/hours and catalog routes plus mobile storefront checkout. Public browsing exposes no CRM contacts. Customer self-service orders are authorized by account ownership; staff access remains separately membership-scoped.

## Migration and validation

Only additive migrations on the verified local Compose PostgreSQL database. No production database operations, table resets, volume deletion or overwrites. Unit validation tests, real PostgreSQL integration tests including composite foreign key rejection and every role/tenant boundary, browser workflow tests, and all M0 regression tests precede module commit/push. Run lint, typecheck, test and build for every completed module. Preserve historical VALIDATION.md entries and report exact outcomes.
