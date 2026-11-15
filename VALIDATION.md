# M2-A human support acceptance — 2026-11-15

Status: **PASS — development environment acceptance.** Implementation branch: feature/m2-customer-support, created from verified/pushed M1-D 23dc30ff5b1355aca275e8b76258d8eb81377a80. Git commit/push and remote SHA verification follow these checks; the delivery reports the verified SHA. Prior M0/M1 validation history below is preserved unchanged.

## Delivered

- Seven persistent Prisma models: SupportChannel, Conversation, ConversationParticipant, Message, ConversationAssignment, ConversationEvent, MessageDelivery. Every business model has tenant_id; composite references prevent cross-tenant parents, senders, channels, assignments and delivery recipients. Conversation/contact references remain tenant-scoped. Additive migration 202611150006_support includes a partial unique current-assignment index and valid sequence/content checks.
- Authenticated create/resume, scoped list/search/status pagination, durable ordered history, idempotent send, delivered/read acknowledgements, unread counts, assignment/transfer, close/reopen, authorized agents and safe audit summaries. Messages store derived sender type, WEB channel, SENT status, sentAt and sequence. Text only, maximum4000; no trusted client identity/tenant/role fields or attachment path.
- Customer ownership is the authenticated account, not an email, phone, CRM ID or conversation ID alone. Existing M1-D tenant/account/contact mapping is reused (including a real checkout-created mapping); first support contact creation is atomic and never adopts a matching email. Owner/Manager manage all tenant conversations; Staff handle current assignments only. Transfer revokes prior Staff HTTP and subscription access.
- Nest HTTP-server ws transport with single-use30-second opaque tickets, exact Origin checks, current session/member/conversation authorization, scoped subscriptions and revocation. Limits: 2KiB frames, 120 controls/min, ten subscriptions and five connections/session/node. No private message payload in notifications. PostgreSQL is authoritative; every notification reauthorizes access.
- Real reconnect/cursor catch-up, duplicate suppression and ten-second HTTP reconciliation. Message acceptance/sequence/audit are committed in one row-locked transaction; CAS versions control assignment/status races. Unknown-result retries reuse the original message key, while an acknowledged intentional repeat uses a fresh key.
- Optional implemented Redis Pub/Sub adapter (SUPPORT_REDIS_ADAPTER=true) sends metadata-only invalidations across instances with origin-loop suppression. Verified with two real API servers. A notification failure never rolls back committed data; clients recover from database history.
- Merchant /inbox with tenant switching, search/filter/pagination, unread totals, real-time chat, authorized CRM sidebar/link, member assignment/transfer, close/reopen, send/delivery/read state and localized audit labels. Customer store widget starts/resumes owned human conversations, sends/receives actual messages and recovers history. English/Chinese/Malay and mobile views. Transport connectivity never claims an agent is online; AI and attachments explicitly unavailable.

## Final verification

| Check | Result | Evidence |
| --- | --- | --- |
| pnpm install --frozen-lockfile | PASS | ws8.18.3 / @types/ws8.18.1 pinned, shared UI workspace dependency recorded in lockfile; no verification bypass. |
| pnpm db:generate | PASS | Prisma Client generated with seven support models and enums. |
| pnpm db:migrate | PASS | Local Compose PostgreSQL only; six applied migrations, schema current. PostgreSQL/Redis healthy. No reset, truncation, volume deletion, destructive migration or production database mutation. Existing five migrations unchanged. |
| pnpm lint | PASS | All14 tasks successful, zero lint errors/warnings. |
| pnpm typecheck | PASS | All14 app/package tasks plus API fixtures and root Playwright types. |
| pnpm test | PASS | API82 passes including6 parent tests; Worker1 pass. Existing67 API tests retained; new3 unit +10 acceptance scenarios +parent +cross-instance Redis test. Zero failure/skip/cancellation. |
| pnpm build | PASS | All10 normal workspace builds passed with final source; isolated E2E production builds also passed. |
| pnpm test:e2e | PASS | Final Chromium:20 tests in96.7s, zero failures/skips/flaky results. M0 4 +CRM3 +Catalog2 +Orders3 +Storefront4 +Support4. |
| Ownership/tenant/RBAC | PASS | Another customer/guest denied, wrong-tenant order/conversation denied, Staff unassigned denied and transfer revokes prior access. Customer DTO excludes CRM/tenant/employee identities. Merchant ticket scoped to tenantA cannot subscribe to tenantB even when its owner belongs to both. |
| Message persistence/idempotency/concurrency | PASS | Four same-key sends create one message; changed key payload409; concurrent new messages have contiguous sequence. Closed conversations reject new sends but permit original-key replay. Version races have one success/one409; immutable audit retained. |
| Delivery/read/unread | PASS | Incoming unread counts, actual history delivery, bounded and monotonic read cursor, preserved READ records, cursor pagination and human reply read receipts. Customer history stays private. |
| Real-time authentication/recovery | PASS | Anonymous/no-ticket upgrade, replayed ticket, hostile Origin and unauthorized subscription rejected. Authorized real WS notification and logout closure verified. Browser explicitly checks WS frames and live receipt; offline message persists and reconnect/reload restores one copy. |
| CRM isolation | PASS | Fresh contact avoids matching-email takeover, checkout-existing mapping reused; cross-tenant FK failures verified for channel, sender/delivery/assignment parents. |
| Limits/content/attachments | PASS | Real Redis30/min sends return429; identical retries still resolve after throttling. Empty/oversized/NUL/spoofed fields rejected. Attachment route404. Literal script content rendered as text, no script execution. |
| Network uncertainty | PASS | Browser deliberately drops the response after a real successful server commit; UI shows retry state, retry yields one durable message, and a subsequent intentional identical message yields a second distinct record. No mock business success is substituted. |
| UI/localization | PASS | Customer and merchant390px screenshots visually inspected; both have no horizontal overflow. English/Chinese/Malay, Inbox search/status filtering, CRM view, assignment/transfer and close/reopen tested in actual Chromium. |
| Secret/artifact audit | PASS | Actual local secret values absent from tracked/new files. .env, credentials, key/DB/dependency/cache/build/test-result/trace files excluded. .env.example contains only placeholders and a noncredential local Redis URL. |

## Findings fixed during acceptance

The first API compile exposed Express5's string|string[] parameter typing; narrowed the trusted router tenant parameter to a string. No authorization rule was relaxed. The first complete browser run passed all three initial support scenarios but an existing Storefront privacy assertion matched both its real error paragraph and Next's route announcer. Scoped that assertion to the real Request failed alert; retained the401/404 and private-order absence assertions. The final full run passes.

Review also added shared conversation locks/rechecks around history/read operations so transfer and reading serialize, made repeated read acknowledgements silent, reset recovery cursors after failed authorization/HTTP reads, localized audit/role labels and improved the mobile search form. Added unknown-result response-loss and deliberate repeated-message tests. No database/data cleanup or authentication-rate bypass was used; all fixtures remain unique local synthetic tenants/accounts.

## Scope and operational limits

M2-A is human WEB chat only. AI sender discriminator is reserved; no client can select AI and no M2-B/bot/provider work was started. Attachments have a documented future security design, with no upload/download endpoint, picker or arbitrary URL message field. No anonymous chat, WhatsApp/email connector, payment, push/email notification, staff-presence/typing indicator or response-time guarantee is claimed. Existing password sessions are used; email verification/OTP/recovery are not added.

Redis adapter default is single-node local notifications. Production requires HTTPS/WSS, secure cookies, explicit origins, Upgrade forwarding, ticket-log redaction and shared broker configuration. Connection quotas are local per API node; distributed connection budgeting and production load/deployment approval are outside this development acceptance. Notification outages fall back to persisted HTTP reconciliation, not a claim of guaranteed broker delivery.

Artifacts remain ignored: test-results/e2e-results.json, support-customer-mobile.png, support-inbox-mobile.png and failure traces. Documentation: README.md and docs/M2-A-DESIGN.md. No M2-B implementation or production publishing performed.

---

# M1-D Customer Portal acceptance — 2026-11-15

Status: **PASS — M1-D development acceptance.** Git synchronization is the final delivery step. This section supersedes the older checkpoint summaries below; their original evidence is preserved as history.

## Delivered scope

- Published merchant storefront `/s/[merchantSlug]` with actual public profile, sanitized logo, merchant-provided business hours/address/contact channels, live catalog/category/search/filter/detail APIs and English/Chinese/Malay responsive views. Only ACTIVE items in a published store are visible. Product/service checkout is real; digital and bundle entries remain preview-only.
- Per-store carts use an immutable public storefront key, separate from tenant IDs/slugs. Quantity updates/removal and persistence store only IDs, quantities and display labels. Backend quote and checkout derive catalog prices and use the existing exact Decimal order engine. Browser price/tenant/customer/contact/status/payment injection is rejected.
- Dedicated customer login/register pages reuse M0 opaque HttpOnly sessions and CSRF/rate controls. Account ownership is distinct from employee membership. Transactional tenant/account/contact mapping never adopts an existing CRM record by matching email/phone. Tenant-composite foreign keys prevent cross-tenant links.
- Authenticated checkout atomically creates PENDING / CUSTOMER / customer_portal / UNPAID orders, snapshots, initial history, audit and original safe idempotency response through the M1-C engine. Concurrent identical retries create one order; operation-scoped checks stop merchant/customer response replay. Failed attempts create no partial CRM mapping or order.
- Customer order list/detail require current account ownership. Responses omit private merchant notes, SKU, tenant/contact/account IDs and actor/audit data. Guest, another customer and a merchant account cannot read that customer's receipt. Merchant order management retains member RBAC, tenant isolation and versioned status transitions; customer refresh shows the committed status.
- Merchant `/catalog/profile` supports public-profile editing and validated logo upload/removal. Logo uses the existing full content-validation and metadata-stripped WebP re-encoding pipeline; Owner/Manager guards run before multipart processing. Contact links only use supplied merchant information. AI support slot explicitly says unavailable; no false online status or M2 features.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Frozen installation / Prisma generation | PASS | Pinned lockfile retained; Prisma Client generated for the additive storefront models. No external dependencies added. |
| Development migration | PASS | `pnpm db:migrate` applied `202611150005_storefront` against local Compose PostgreSQL. Five migrations, all current. PostgreSQL/Redis healthy. No reset, table cleanup, volume removal, or production mutation. |
| pnpm lint | PASS | Final all-workspace run: 14 tasks successful, zero errors/warnings. |
| pnpm typecheck | PASS | Final app/package/API test/browser types passed (14 tasks plus root browser/configuration types). |
| test | PASS | API 67 passes including 5 parent tests; Worker 1 pass. Includes all previous 55 API tests and new 2 unit + 9 integration scenarios + parent. Zero failure/skip/cancellation. |
| pnpm build | PASS | All 10 normal workspace builds passed. Isolated E2E production builds passed with the final checkout fixes. |
| pnpm test:e2e | PASS | Final Chromium run: 16 tests in 80.5 seconds, zero unexpected failures/skips/flaky results. M0 4 + CRM 3 + Catalog 2 + Orders 3 + storefront 4. Includes persistent cart clear, deliberate identical new purchase and original-key replay. |
| Monetary integrity | PASS | Exact 0.1000×3 + 0.2000×2 = 0.7000 and selected variant 0.3333×3 = 0.9999; changed quote rejected; customer totals/price injection rejected. Prior large precision/round-trip tests retained. |
| Isolation / identity | PASS | Customer A/B and guest private-read denial; merchant A/B order denial; no matching-email CRM takeover; distinct per-tenant account/contact mapping and invalid composite reference rejection. Cart envelopes reject another store key. |
| Availability / idempotency | PASS | Foreign/draft/archived/digital/bundle items denied checkout. Four concurrent same-key checkouts produce one order/history. Different-key concurrent first checkouts share one CRM mapping. Original receipt can be replayed after state changes/unpublishing; new checkout is refused. |
| Upload security | PASS | Staff rejected before parsing, invalid image contents rejected, >2 MiB rejected, valid PNG re-encoded to WebP; public image has sandbox CSP/nosniff and deletion removes public access. |
| UI review | PASS | 390×844 shop and Malay confirmed/unpaid receipt screenshots visually inspected, without horizontal overflow. Three languages checked in real browser. |
| Secret/artifact audit | PASS | Real local credential values absent from tracked/new source. .env, key files, dependency/cache/build/DB/browser artifacts excluded; localhost Redis URL in .env.example is intentionally a noncredential development address. |

## Diagnosed checks and limits

The initial added integration fixture shadowed its own slug variable, causing a TypeScript error and parent-test failure. Renamed the fixture binding and reran the full suite successfully; no assertion or authorization control was removed. The added profile browser test then exposed unreliable label association on textareas with existing content; explicit translated aria-labels fixed this, and all 16 browser tests passed. Final code review also corrected checkout cart persistence: clear localStorage synchronously before navigation, and remove the client attempt key only after acknowledged success so an intentional identical repeat purchase is possible. The final browser flow verifies an empty cart after reload plus a new order ID for that deliberate repeat; captured original-key replay still returns the first order. A direct Prisma status invocation without loading root .env reported DATABASE_URL missing; rerunning with `node --env-file=.env` confirms all five migrations current. Local rate-counter isolation remains test-only and does not change production authentication limits or clear Redis keys.

Payment remains UNPAID only: no collection, gateway, refund, shipping, inventory reservation, appointments, digital delivery, bundle fulfillment or AI/live chat. Tax/discount remain zero from M1-C. Customer accounts use existing passwords/sessions; email verification/OTP/recovery are not claimed. Browser storage is required for persistent cart/checkout retry keys; no session token, password, name or note is stored there. These are development acceptance results, not production deployment approval.

Artifacts (ignored): `test-results/e2e-results.json`, `test-results/storefront-mobile-shop.png`, `test-results/storefront-mobile-receipt.png`. API/model contracts: `docs/M1-DESIGN.md`. No M2 implementation started.

Git baseline: feature/m1-core-business at 331ad33932be45947919e84b9315636d0c8dea8d. Develop baseline: 9ebf44e3352fc412bbf682888d3d32849f2e070f. Final commit/push and remote SHA are reported in the delivery after successful checks; no force push or merge to develop.

---

# NEXORA M1-C Orders — Latest acceptance

Date: 2026-11-15 (Asia/Kuala_Lumpur). **M1-C: PASS for local development acceptance. M0/M1-A/M1-B regression: PASS.** No M1-D implementation, payment integration or production deployment was performed. Previous records are preserved below.

## Scope and safety

Continued clean feature/m1-core-business at fafefa10331aab82272b486cf88e7cf3fb7712d2, verified against GitHub at task start. Read project instructions, README, validation record, schema and existing API contracts. Preserved the existing applications, authentication, tenant controls, CRM, catalog, Redis limits and historical migrations/data.

Verified the database destination remained localhost/nexora, with no injected production database URL/production mode and healthy local Compose PostgreSQL/Redis. Additive migration 202611150004_orders adds Order, OrderItem, OrderStatusHistory, OrderEvent and IdempotencyKey, tenant-scoped foreign keys and uniqueness, plus monetary integrity checks. It adds the composite CatalogVariant identity needed to bind selected variants to their parent item and tenant. Migration SQL was inspected for absence of table/column drops, resets or data deletion. Four migrations are recorded applied; repeat deploy reports no pending work. Old migrations were not edited.

## Implemented engine

- Real catalog pricing with optional active variants and CRM contact association; same-tenant and one-currency validation. Catalog/variant shared locks protect captured prices. Name/variant/SKU/unit-price and contact-name snapshots remain stable when catalog/CRM data changes.
- Decimal-only money arithmetic with precision 40, unit-price Decimal(18,4) and order-total Decimal(24,4). All amounts cross HTTP as four-place strings. Discounts/tax are fixed at zero in this foundation; no FX, tax engine or payment-settlement rounding. Client prices, sums, currency, source, tenant and customer ownership fields are rejected.
- Atomic creation of order, lines, history, audit and original idempotency response. Transaction advisory lock + tenant/actor/key uniqueness makes concurrent identical retries resolve to one order. Different payload/key reuse returns 409. Replay returns the original JSON response without repricing, even after later edits.
- Mandatory current versions and row locks for draft edits/state actions; one winner under concurrent state updates. Every accepted write appends an audit event, and every status transition appends history. Draft changes retain before/after audit snapshots. Completed/cancelled orders have no permitted edits/transitions; no order delete endpoint.
- Canonical tenant-prefixed /orders APIs and active-tenant /api/orders aliases, all session/member authenticated. Owner/Manager write; Staff reads. Search, filters and bounded pagination for lists, history and audit.
- Merchant /orders, /orders/new, /orders/:id and /orders/:id/edit with three-language workspace, real searchable CRM/catalog selectors, server quote/summary, idempotent submission, draft edit and state/history/audit views. Existing off-page selections are labeled saved snapshots. Note/contact-only draft changes preserve original prices; explicit recalculation/replacement reprices on the server.
- Customer ownership-filtered read APIs: /api/customer/orders and /api/customer/orders/:id. Require current session, source CUSTOMER and customerUserId matching that account. CRM email/contact, merchant membership or knowing an ID cannot grant this path. Customer DTO omits private notes, SKU, actor/audit and tenant/contact/account identifiers. Customer create remains a documented future M1-D contract, not an exposed endpoint or checkout UI.

## Validated lifecycle

DRAFT → PENDING/CONFIRMED/CANCELLED; PENDING → CONFIRMED/CANCELLED; CONFIRMED → PROCESSING/CANCELLED; PROCESSING → COMPLETED/CANCELLED. COMPLETED/CANCELLED are terminal. Only DRAFT supports line/contact/note editing. State transitions cannot be mixed with draft edits. The /confirm, /cancel and /complete actions independently enforce the backend rules; arbitrary status PATCH assignments are denied.

## Final checks

| Check | Outcome | Evidence |
| --- | --- | --- |
| pnpm install --frozen-lockfile | PASS | Pinned dependency set/lockfile retained; no new external dependencies or verification bypass. |
| pnpm db:generate | PASS | Prisma Client generated with all five order models. |
| pnpm db:migrate | PASS | Local additive migration applied; four successful migrations, no pending work, no reset. |
| pnpm lint | PASS | All applications/packages, zero errors or warnings. |
| pnpm typecheck | PASS | All apps/packages, API tests/fixtures and browser tests/configuration. |
| pnpm test | PASS | API runner 55 passes including 4 parent tests; Worker 1 pass. Zero failures/skips/cancellations. New order coverage is 4 unit tests + 13 integration scenarios + their parent; all previous 37 API checks retained. |
| pnpm build | PASS | All ten workspace builds, including the three portals, compiled API and Worker. Isolated E2E production builds also passed. |
| pnpm test:e2e | PASS | Final Chromium run: 12 tests, 60.8 seconds, zero failures/skips/flaky results. Orders 3 + Catalog 2 + CRM 3 + M0 4. |
| Correct totals/precision | PASS | 0.1000×3 + 0.2000×2 = 0.7000; selected variant 0.3333×3 = 0.9999. Large 999999999999999999.1000 round-trips through actual PostgreSQL; unit tests cover wide 24-digit results without default Decimal precision loss. |
| Price tampering/atomicity | PASS | Supplied prices/totals/tenant/source/account fields rejected; invalid contact, unavailable/foreign items and mixed currency create no partial order/idempotency record. Changed server quote conflicts. |
| Idempotency | PASS | Sequential replay, conflicting payload, tenant/actor scoping, retry after validation failure, and six concurrent same-key creates; one order, initial history and audit event, identical semantic responses. |
| Concurrency/transitions | PASS | Racing confirm/cancel with one version produces one success and one 409, one version increment and one audit/history addition. Invalid transitions, stale versions and edits to terminal orders denied. |
| History/audit | PASS | Creation, draft edits, exact transition order, reasons, safe actor fields, before/after snapshots and pagination verified. |
| Tenant/RBAC/CRM | PASS | Owner/Manager write, Staff read-only, ordinary account rejection, wrong-tenant detail/history/events/action denial, scoped CRM association and database composite reference failures. Active-tenant aliases verified. |
| Customer privacy foundation | PASS | Positive own-customer reads tested with explicit local DB fixtures. Other customers and merchant creators cannot use that path; matching CRM email grants nothing. Private DTO fields absent. Anonymous reads denied; no bare public order read or customer-create route. |
| Browser/localization/mobile | PASS | Real multi-line quote/create/replay, CRM association, note edit, complete lifecycle, cancellation, search/status/source filters, staff/manager access, merchant switching and private ID denial. English/Chinese/Malay headings verified. 390×844 completed order has no horizontal overflow; screenshot visually inspected. |

Final browser artifact: test-results/e2e-results.json. Phone screenshot: test-results/order-mobile-completed.png. Generated artifacts and cookie-bearing traces remain ignored and are not committed. Real test fixtures use isolated local tenants/accounts and independent Redis counter prefixes; no mock business records are rendered, no tables/Redis keys are cleared.

## Diagnosed initial failures

The first API run failed two test assertions/fixtures (plus their parent): concurrent response comparison incorrectly depended on PostgreSQL JSONB object-key order, and a manually seeded customer-read fixture used a 41-character number in a 40-character column. Changed to semantic deep equality without dropping any field comparison, and corrected that fixture's identifier length. Reran the complete API suite successfully, then added the large-value PostgreSQL precision case and reran: 55 passes. No assertion, authorization or concurrency check was bypassed.

The full browser suite passed on its first M1-C execution. Required checks were rerun after final test changes. No unresolved failed required check remains.

## Delivery boundary

README, AGENTS and docs/M1-DESIGN.md updated; final commit SHA and matching remote verification are provided in the task delivery. No forced push, branch deletion, secret staging, database reset or direct production modification. Discount/tax rules, payments, AI/appointment processing and customer order creation/checkout remain unimplemented; the customer creation/authorization contract is documented for M1-D, which was not started.

---

# Previous validation record (preserved)

# NEXORA M1-B Catalog — Latest acceptance

Date: 2026-11-15 (Asia/Kuala_Lumpur). **M1-B: PASS for local development acceptance. M0 and M1-A regression: PASS.** No M1-C development or production deployment was performed. Previous validation records are preserved below.

## Implemented scope

Continued the clean `feature/m1-core-business` branch from `fa0fe598c9d52e5b17a41a5fb320408c52f176dd`, matching the remote at task start. Preserved authentication, CRM, three applications, previous migrations and existing local data.

- Five models: CatalogItem, CatalogCategory, CatalogVariant, CatalogMedia and PriceList, with physical tenant_id fields, tenant-scoped business uniqueness and composite tenant/parent references.
- Unified PRODUCT/SERVICE/DIGITAL/BUNDLE item types; description, SKU, category, currency, Decimal(18,4) base/variant prices, status and timestamps. DIGITAL/BUNDLE reserve types only; no delivery/composition engine.
- Item create/read/update/soft delete; category management; variants; price-list foundation list/create; pagination/search/status/type/category filters; status changes and explicit public-store slug/publication settings.
- Owner/Manager manage; Staff reads. Private requests recheck membership; upload write guards run before multipart decoding. Cross-tenant IDs cannot select or mutate unrelated records.
- Safe image upload/read/removal. One file plus at most one metadata field, 2 MiB input, declared MIME matched to fully decoded PNG/JPEG/WebP content, 16-million-pixel limit, no animation, stripped/re-encoded WebP <=1600×1600 and <=1 MiB. At most ten images per item with a serialized database check. Binary content is excluded from JSON and served with nosniff/media CSP.
- Merchant routes /catalog, /catalog/new, /catalog/:itemId, /catalog/:itemId/edit, /catalog/categories, /catalog/settings. English, Chinese and Malay interface labels; mobile and desktop browser workflows use real persisted data.
- Customer PublicCatalog component at /stores/:slug and /stores/:slug/items/:itemId. Only enabled stores and ACTIVE nondeleted items are public. Explicit DTO excludes SKU, tenant identifiers, inactive variants, status/deletion fields, raw media bytes and all CRM/account data. Direct unpublished item/image URLs are denied.

## Database and precision evidence

Verified the database destination is localhost/nexora, no injected production database URL, and local Compose PostgreSQL/Redis are healthy. Additive migration `202611150003_catalog` creates the catalog enum/tables/indexes/FKs and adds private-by-default store routing fields to Tenant. SQL was inspected for absence of drops/truncation/deletes. Database CHECK constraints reject negative item/variant prices. Repeat deploy reports no pending migrations. Old M0/CRM migrations were not edited and no database was reset.

Prices enter and leave the API as decimal strings; no frontend floating-point calculation. PostgreSQL round-trip of 99999999999999.9999 and 0.1000/0.2000 is verified; Decimal addition yields exactly 0.3000. Numeric JSON, exponent notation, excessive precision and negatives are rejected. Catalog unit-price precision does not claim currency settlement rounding or FX conversion.

The globally unique public slug is a routing handle necessary for unambiguous /stores/:slug; item/category/variant/price-list business constraints include tenant scope. Category deletion conflicts while referenced, including by tombstoned items. Deleted item rows and their SKU reservations are retained.

## Final validation

| Command/check | Result | Evidence |
| --- | --- | --- |
| Frozen dependency install | PASS | Pinned workspace installation and updated lockfile; no integrity or TLS bypass. |
| pnpm db:generate | PASS | Prisma Client generated with all five catalog models. |
| pnpm db:migrate | PASS | Catalog migration applied only to local development DB; repeated deploy has no pending work. |
| pnpm lint | PASS | All app/package ESLint checks, zero errors or warnings. |
| pnpm typecheck | PASS | Apps/packages, API fixtures/tests, browser tests/configuration. |
| pnpm test | PASS | API runner 37 passes (including 3 parent tests), Worker 1 pass; zero failures, skips or cancellations. Includes all M0/CRM tests, 3 catalog unit tests, 7 catalog integration scenarios and an independent real authentication-limit regression. |
| pnpm build | PASS | Ten workspace builds including all portals, API and Worker; isolated production E2E builds also pass. |
| pnpm test:e2e | PASS | Final run: 9 Chromium tests, 39.7 seconds, zero failures/skips/flaky outcomes. Catalog 2 + CRM 3 + M0 4. |
| Item/category/variant CRUD | PASS | Creation, exact prices, scoped uniqueness, updates, unused-category removal, referenced-category conflict, variant changes/removal and item soft deletion. |
| Tenant isolation/RBAC | PASS | Owner/Manager writes, Staff read-only, anonymous/nonmember denial, wrong-tenant object IDs, overposting and direct database cross-tenant category/variant/media inserts rejected. |
| Public visibility | PASS | Draft/private/archived/deleted items and images denied; inactive variants and private fields absent from public responses. Store unpublish and slug conflicts tested. |
| Upload security | PASS | Real decode/re-encode/read, MIME spoof, SVG, corrupt/truncated bytes, >2 MiB uploads, pixel-limit excess, pre-parse authorization, tenant image scope and concurrent ten-image cap. |
| Language/responsiveness | PASS | Merchant language switches en/zh/ms; mobile catalog CRUD, images and publication; customer Chinese public detail at 390×844 has no horizontal overflow and was visually inspected. Desktop role flows also pass. |
| Authentication controls | PASS | Production Data/session/limit implementation unchanged. Acceptance Redis isolation does not alter thresholds; twenty invalid-email checks return 401 and the twenty-first returns 429. |

Latest browser JSON: test-results/e2e-results.json. Public mobile screenshot: test-results/catalog-public-mobile.png. Generated results, screenshots and potentially sensitive traces remain ignored. All business fixtures are uniquely scoped synthetic test records persisted through the real API/database; no mock data is rendered by the application.

## Failures diagnosed and corrected

1. Normal upload initially returned multipart "Too many parts". Corrected parser boundary accounting while retaining one-file/one-field, byte limits, full image validation and transactional count controls. Dependent image/public checks then passed.
2. Browser navigation initially had duplicate Catalog labels, and a fixture expected uppercase account text despite M0 email normalization. Clarified navigation as Catalog/All items and normalized fixture email expectations.
3. Item edit tests sometimes populated the old page's variant inputs before Next client navigation completed, then submitted unchanged item fields. Network traces established the cause. Added named item forms and scoped readiness/field interactions; retained the exact name/price assertions. Post-save/deletion navigation reads fresh page data. Full suite passes without retries or weakened assertions.
4. Repeated acceptance registrations shared development Redis IP counters and correctly triggered 429, failing a later run. Test-only startup clients now use unique Redis key prefixes and require loopback development targets; no production authentication changes, flushed keys or raised thresholds. Added an explicit real limit-enforcement test and reran API and browser acceptance successfully.

## Delivery and limits

README and docs/M1-DESIGN.md updated with schemas, APIs, permissions, exact-price contract, upload limits and test isolation. Final feature commit SHA and matching remote verification are reported in the task delivery. No force push, branch deletion, secret staging, production DB modification, project recreation or data reset.

PriceList is metadata/list-create foundation, without entries, overrides or discount resolution. Public prices use item and variant values. Images currently use bounded PostgreSQL byte storage, not a deployed object store/CDN. Digital fulfillment, bundle composition, cart, checkout, payment, orders and M1-C remain outside this delivery as requested. No outstanding failed required checks remain in the final accepted runs.

---

# Previous validation record (preserved)

# NEXORA M1-A CRM — Latest acceptance

Date: 2026-11-15 (Asia/Kuala_Lumpur). **M1-A: PASS in the local development environment. M0 regression: PASS.** M1-B/C/D remain unimplemented at this checkpoint. Prior M0 validation and source-recovery history are preserved below.

## Scope and architecture

Branched `feature/m1-core-business` from freshly fetched `develop` at `9ebf44e3352fc412bbf682888d3d32849f2e070f`; the working tree was clean. The user's M1 authorization superseded AGENTS.md's previous M0-only restriction, and the instruction file now reflects the authorized sequence.

Design and API contracts: `docs/M1-DESIGN.md`. Added independent Customer and CustomerFollowUp records with physical tenant_id columns, tenant indexes and a composite tenant/customer foreign key. CRM contact email never grants User login or employee membership. M0 Data/session/member logic was extracted unchanged to a shared provider file; existing security mechanisms remain in effect.

Merchant routes: `/crm`, `/crm/new`, `/crm/:customerId`, `/crm/:customerId/edit`. Features: real database-backed list/search/pagination, status/tag filters, create/edit/detail, normalized tags and notes, append-only follow-up history, tenant switching, and mobile layout. No mock business records are substituted for implementation.

Permissions: all merchant roles can view and append follow-ups; Owner/Manager can create/edit contact profiles, tags and notes; Staff cannot. Each API endpoint checks session and membership before accessing scoped records. Cross-tenant object IDs return 404 to a member of the wrong tenant, and nonmembers receive 403. Unknown fields and forged tenant/author/time inputs are rejected. Contact deletion and history editing are not exposed.

## Database safety

Confirmed the runtime had no injected DATABASE_URL or production NODE_ENV; the repository's ignored local configuration points to localhost/nexora and healthy local Compose PostgreSQL/Redis services. Migration `202611150002_crm` adds only the CRM enum, tables, indexes and foreign keys. It was reviewed for absence of drops/truncation/deletes, applied successfully, and repeated deploy reported no pending migrations. Existing M0 migration files and data were retained. No production database was accessed or reset.

## Validation results

| Check | Outcome | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Workspace links updated for shared CRM contracts; frozen installation succeeded. |
| `pnpm db:generate` | PASS | Prisma Client 6.19.2 generated from extended schema. |
| `pnpm db:migrate` | PASS | Additive CRM migration applied to local PostgreSQL; repeat deploy has no pending work. |
| `pnpm lint` | PASS | ESLint across all applications/packages, zero errors or warnings on final run. |
| `pnpm typecheck` | PASS | All apps/packages, API test code, and browser test/configuration code. |
| `pnpm test` | PASS | API runner: 25 passes, including 2 parent tests, 4 CRM validation unit tests, 8 CRM integration scenarios and 11 M0 scenarios; Worker: 1 real Redis queue test. Zero failures/skips/cancellations. |
| `pnpm build` | PASS | Ten workspace builds, all three portals, compiled API and Worker. Both normal and isolated E2E Next builds succeeded. |
| `pnpm test:e2e` | PASS | 7 Chromium tests: 3 CRM and 4 M0 regressions. Zero failures, skips or flaky outcomes in final results. |
| Tenant isolation | PASS | Tenant-scoped list totals, wrong-tenant detail/update/history, nonmember access, forged tenantId/authorId and immediate membership revocation tested. |
| Database relationship boundary | PASS | Direct invalid cross-tenant follow-up insertion rejected by PostgreSQL composite foreign key (Prisma P2003); no record inserted. |
| Identity and session boundary | PASS | Matching CRM contact/account email does not create membership; missing auth, revoked membership and replay of logged-out sessions denied. |
| Owner/Manager/Staff | PASS | Manager create/edit, Staff view/follow-up, Staff profile write rejection and UI protection validated. |
| UI workflow | PASS | Mobile create/view/edit with nonempty notes, tags, history, search/status/tag filters, no-result state and pagination across 11 real synthetic records. Tenant switching hides previous records. |
| Mobile layout | PASS | 390×844 viewport has no horizontal overflow; CRM detail screenshot visually inspected. |

Latest E2E JSON: `test-results/e2e-results.json`. Mobile screenshot: `test-results/crm-mobile-detail.png`. Both are ignored local artifacts; traces may include cookies and are never committed. Tests use uniquely identified synthetic data and isolated Worker queues; they do not truncate existing tables.

## Diagnosed failures and corrections

- Initial E2E startup encountered development ports already in use and executed no tests. E2E now uses dedicated 3100–3102/4100 ports, isolated .next-e2e directories, explicit allowed origins, and separately hashed build configuration. Existing development listeners do not satisfy test readiness. Generated normal-build Next declarations are restored afterward.
- The first running suite passed six tests and failed the mobile edit scenario because a wrapping textarea label included initial text in exact-label lookup. Replaced notes/tags labels with explicit htmlFor/id associations. Rebuilt and reran the complete suite: seven tests passed. No assertion or security check was disabled.
- An exploratory migration-diff command failed because it was given an empty shadow database URL. Generated the additive diff directly between the prior and current schema files instead, requiring no shadow or production database; only the inspected migration was applied.
- Aborted list/form requests are prevented from committing stale UI state after navigation. Tenant switching hides children and reloads the CRM context.

## Delivery boundary

README and AGENTS.md updated; M1 design and this validation record included in the CRM commit. The final feature-branch SHA and remote push verification are reported in the task delivery. No force push, branch deletion, project recreation, secret commit, database reset or production deployment occurred. This checkpoint does not claim catalog, uploads, orders or public storefront completion; they remain M1-B/C/D. CRM does not introduce destructive delete/export endpoints or automated customer-account linking.

---

# Previous validation record (preserved)

# NEXORA M0 — Latest acceptance

Date: 2026-11-15 (Asia/Kuala_Lumpur). **M0: PASS for the requested local development acceptance scope.** This is an explicitly authorized new implementation, not recovery of the lost original source. Earlier blocked results and checkpoint notes are preserved below as history.

## Implemented scope

- pnpm 10.32.1/Turborepo workspace; three responsive Next.js/TypeScript/Tailwind portals with home, registration, login and Dashboard routes.
- NestJS API; scrypt password hashes; opaque HttpOnly SameSite=Lax cookies backed by hashed, expiring database sessions; rotation on login and server-side revocation on logout; Redis authentication rate limits and origin/header protections.
- Merchant creation, membership-scoped listing and switching, Dashboard, Owner/Manager/Staff permissions, owner-only addition of existing registered members, and merchant rename for Owner/Manager.
- Every merchant endpoint rechecks authenticated membership and role. Request body/query tenantId cannot bypass access checks. Platform administrator permission is separate and cannot be granted by ordinary signup.
- Prisma User/Tenant/Membership/Session models, committed PostgreSQL migration, persistent Compose PostgreSQL/Redis services, dependency readiness and API liveness endpoints.
- BullMQ worker with a healthcheck handler. AI/business jobs and M1 features remain unimplemented.

## Final checks

| Command or acceptance check | Result | Evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | Final dependency set installed using the pinned package manager and committed lockfile. Optional dependency lifecycle scripts remain blocked by pnpm default policy; the required Prisma generation, compilation, and runtime checks succeeded explicitly. |
| `pnpm db:generate` | PASS | Prisma Client 6.19.2 generated with TLS/checksum verification enabled. |
| `pnpm db:migrate` | PASS | `202611150001_m0` applied; repeat deploy reported no pending migrations. No reset, volume deletion or existing-data replacement. |
| `pnpm lint` | PASS | ESLint across all ten workspace packages/apps, zero errors or warnings on final run. |
| `pnpm typecheck` | PASS | All workspace apps/packages plus API test code and Playwright configuration/tests. |
| `pnpm test` | PASS | API: 12 runner-reported passes (one parent + 11 acceptance scenarios); Worker: one pass. Zero failures, skips or cancellations. Integration task caching disabled. |
| `pnpm build` | PASS | All ten workspace package/application builds, including all three Next.js production builds and API/Worker compilation. |
| `pnpm test:e2e` | PASS | Four Chromium browser scenarios passed in 19.5 seconds against the compiled API and production Next.js servers; zero failures, skips or flaky tests in final JSON results. |
| Registration/login/logout | PASS | Real browser forms and real PostgreSQL API tests; duplicate signup, invalid password, session rotation, expiry and old-cookie replay covered. |
| Merchant creation/switching/Dashboard | PASS | Two real merchants, authenticated membership listing and active Dashboard verified via browser and API. |
| Owner/Manager/Staff | PASS | Owner adds members, Manager edits merchant, Staff read-only; API denies direct forbidden writes even when UI is bypassed. |
| Tenant isolation/forged tenantId | PASS | Unauthorized reads, writes, switching and enumeration denied; injected body tenantId rejected and query tenantId cannot change authorized active merchant. |
| Platform boundary | PASS | Ordinary accounts denied in browser and API. Positive authorization tested using a synthetic database-controlled administrator with its flag restored afterward. |
| Responsive layout | PASS | Chromium checks Customer Portal at 390×844 without horizontal overflow; desktop Merchant Dashboard screenshot visually inspected. |
| Database/Redis/Worker/API health | PASS | Healthy Compose services; API performs SELECT 1 and Redis PING; worker processed a real Redis queue healthcheck job. |

`pnpm dev` startup was also exercised: API readiness returned both dependencies up, and all three login routes returned their expected portal HTML.

Final E2E results are retained locally under `test-results/e2e-results.json`; screenshots include `test-results/merchant-dashboard.png` and `test-results/customer-mobile.png`. These generated artifacts and sensitive traces are ignored and are not committed. API tests create uniquely named synthetic data and do not clear existing tables. Worker tests use isolated, uniquely named queues.

## Issues found and resolved

1. Managed-machine global pnpm differed from the pinned version, and default writable storage was unavailable. Selected the pinned executable outside the checkout and documented writable storage setup.
2. Turbo strict environment filtering initially removed package-manager storage and proxy settings. Added explicit environment pass-through; Prisma generation then succeeded without weakening verification.
3. Worker initially passed a Redis instance whose dependency version differed from BullMQ's internal type. Switched to supported connection options; compilation and a real queue test passed.
4. Initial browser run passed two scenarios and failed two. Added an explicit accessible name to the role select and narrowed an alert assertion that also matched Next.js's route announcer. Rebuilt portals and reran the complete E2E suite: four passed.
5. Integration checks now bypass Turbo test caching so a cached result cannot hide database/Redis failure.

## GitHub and operational scope

Initial skeleton was pushed and its remote SHA verified before domain development: `7e62ba34adf948fea6e6f3bd9db6f49d7d56ab70`. Backend checkpoint was also pushed and verified: `a805fb07819eac657770494d8c3113ec01bdb4f0`. Development branch: `develop` on `kennystudio09-cpu/NEXORA`. The final acceptance commit SHA is reported after push verification in the task delivery rather than embedded recursively in this file.

`.env` is local and ignored. No real secret, database file, dependency directory, cache or browser trace is intended for Git staging. Persistent Docker volumes remain intact. No forced push, branch deletion, database reset or M1 development occurred.

This acceptance validates the local M0 workflow. Deployment/publication, external domains, production HTTPS/session policies, email verification, password recovery, MFA, and audit logging were not performed. Customer business features and AI providers belong to later phases; shared and ai-core packages intentionally reserve those boundaries. No default platform admin password is seeded. README documents roles, local startup, secure environment requirements and the operator-controlled admin provisioning boundary.

---

# Historical validation record (preserved)

# M0 Validation

Validation date: 2026-11-15 (Asia/Kuala_Lumpur).

## Result

M0 is blocked and has not passed. No application code was available in this task to validate or repair. No existing project was deleted or recreated.

## Environment evidence

- Current runtime configuration reports spec revision 1, observed revision 1, current observations, and enforced restricted networking.
- The new runtime's enforced effective allowed hosts include `binaries.prisma.sh`; the requested domain permission is now applied.
- `curl -I --max-time 20 https://binaries.prisma.sh` completed with exit code 0: proxy CONNECT succeeded (HTTP 200), and the upstream root path responded HTTP 404. HTTPS connectivity is verified; no Prisma artifact download or generation is validated by this root-path check.
- `/workspace/NEXORA` contains only `.git` and this report. `git status --short --branch` reports no commits on `work` and this report as untracked.
- A read-only `git ls-remote origin` completed successfully but returned no references.
- No `package.json` was found within five directory levels of `/workspace` outside node_modules.

## Required checks

| Check | Outcome | Evidence |
| --- | --- | --- |
| `pnpm db:generate` | Failed | Exit 1, `ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND`: no package.json, package.yaml, or package.json5 in `/workspace/NEXORA`. |
| `pnpm db:migrate` | Not run | Generation did not succeed; application and migration files are absent. |
| `pnpm test` | Not run | Application manifest and tests are absent. |
| `pnpm typecheck` | Not run | Application manifest and source are absent. |
| `pnpm build` | Not run | Application manifest and source are absent. |
| API compilation | Not run | API source and build configuration are absent. |
| Registration and login E2E | Not run | Application and E2E tests are absent. |
| Merchant switching E2E | Not run | Application and E2E tests are absent. |
| Tenant isolation E2E | Not run | Application and E2E tests are absent. |
| Permissions E2E | Not run | Application and E2E tests are absent. |

## Prerequisites to resume

Attach the existing NEXORA project checkout or provide its populated repository branch to this task, preserving existing project files. The domain permission is now applied and no further network configuration change is established as necessary. Then rerun generation, followed by non-resetting database migration, API compilation, all tests, typecheck, build, and the required E2E scenarios. No repository defect has been established by this blocked run. No database migration or reset was performed, and no project was rebuilt or recreated.

## Source recovery investigation

- Searched accessible portions of `/workspace`, `/tmp`, `/home`, `/opt`, and `/mnt` for NEXORA-named files, the requested backup, pnpm lockfiles, Compose files, and agent instructions. No matching source or backup was found; inaccessible directories cannot be ruled out.
- `/workspace/NEXORA-M0-source.zip` does not exist in this instance. Accessible workspace, temporary, home, and mount directories contain no other application checkout identified by `.git`, `apps`, or `packages` directories.
- `git branch -a` and `git reflog --all` returned no entries. `git fsck --full --no-reflogs` reported unborn HEAD and no default references, with no recoverable objects. `git count-objects -v` reported zero loose and packed objects.
- Origin is `https://github.com/kennystudio09-cpu/NEXORA.git`. A fresh `git ls-remote origin` succeeded with no refs returned. Git read access works; write permission has not been tested.
- None of the required `apps/`, `packages/`, `package.json`, `pnpm-lock.yaml`, or `docker-compose.yml` is available.
- No source commit, development branch, or push was created: publishing the validation report alone would not restore the requested project. No force push, branch deletion, or code replacement occurred.
- Secret exclusion and ignore rules cannot be audited without the original project. Before any recovered source is committed, inspect staged file names and changes, exclude `.env`, secrets, database files, dependencies, and caches, and inspect archive paths before extraction to avoid overwriting current files.

## Remaining acceptance coverage

`pnpm install --frozen-lockfile` and `pnpm lint` were not run because the manifest and lockfile are absent. All application checks remain unrun, including logout, merchant creation, Dashboard, Owner/Manager/Staff access, forged tenantId rejection, old-cookie rejection after logout, and database/API health. These are blockers to M0 acceptance, not passing or skipped tests. No database state was changed.

## Provisional three-portal direction

The current architecture cannot be assessed without source. After recovery, inventory routes, authentication/session handling, tenant resolution, database models, and shared packages before selecting concrete application boundaries. Consider separate Customer, Merchant, and Platform Admin entry points while reusing reviewed UI and domain packages. Enforce authorization and tenant ownership in the API, derive tenant access from authenticated memberships, and keep platform administration behind explicit server-side permissions and audit logs. Preserve existing routes and data during incremental migration; validate session isolation and cross-tenant negative tests at each step. This is a proposal only: no M1 implementation or architecture migration was performed.

## Required human action

Recover the original project from the previous development task/workspace or its local copy and attach `NEXORA-M0-source.zip` here, or push it to a non-destructive development branch in the target repository and provide the branch name. Do not include secrets or database data in the archive. This task cannot access unavailable previous task files through the tools currently provided. Source recovery is the prerequisite to GitHub synchronization and every remaining M0 check.

## Authorized rebuild: initial skeleton checkpoint

On 2026-11-15 the user explicitly authorized creating a new M0 project after source recovery failed. Earlier entries describe the missing original project and remain preserved as history.

Created Customer, Merchant, and Platform Admin Next.js/Tailwind entry points, a NestJS API liveness endpoint, a BullMQ worker foundation, five shared packages, Prisma configuration, and persistent PostgreSQL/Redis Compose services. No authentication, tenancy, RBAC, domain migrations, or acceptance tests are implemented at this checkpoint. M0 remains BLOCKED pending checkpoint publication and implementation.

Skeleton JSON parsing and sensitive-path ignore checks passed. Docker daemon is available. Initial lockfile generation required moving pnpm writable storage outside the checkout to /workspace/.nexora-tools. No database service was started and no database data was changed. Dependency installation, compilation, functional tests, and E2E are not yet validated.

## M0 backend checkpoint

Initial skeleton pushed to develop and verified at 7e62ba34adf948fea6e6f3bd9db6f49d7d56ab70. PostgreSQL 16 and Redis 7 containers are healthy. Prisma Client 6.19.2 generation and migration 202611150001_m0 passed. API compilation passed. API integration runner reported 12 passing tests (one parent plus 11 acceptance scenarios), zero failures or skips, using real PostgreSQL/Redis. Coverage includes registration, login/session rotation, logout cookie replay rejection, two-merchant switching, role access, cross-tenant negative cases, malicious tenantId, immediate membership revocation, platform authorization, expired sessions, and readiness.

Resolved environment issues: use the pinned pnpm executable for Turbo children, and pass proxy plus writable package-manager storage variables through Turbo strict environment filtering. No TLS or checksum verification was disabled. Browser E2E and full monorepo checks remain pending at this checkpoint.
