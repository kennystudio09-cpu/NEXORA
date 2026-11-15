# M2-A human support and real-time chat

Base: verified M1-D 23dc30ff5b1355aca275e8b76258d8eb81377a80. Branch: feature/m2-customer-support. Preserve all M0/M1 data and endpoints. This module implements authenticated human chat only; M2-B AI and attachments are not enabled.

## Identity and authorization

Reuse opaque HttpOnly M0 sessions. Never accept tenantId, senderId, senderType, customerUserId or roles in message bodies. Tenant is derived from an authorized merchant path or a published storefront slug, and the sender is derived from the current session and customer/merchant endpoint. Customer accounts can only access conversations whose customerUserId matches their account. Employee access independently rechecks current Membership. Owner/Manager can read/reply/manage every conversation in that tenant; Staff can read/reply/read-mark/close/reopen only the conversation's current assignment. Staff cannot assign themselves, transfer, list agents, or recover access from an old participant record. A CRM email/phone is never proof of ownership.

First customer conversation reuses the M1-D CustomerAccountLink(tenant,user) when present. Otherwise create a fresh ACTIVE CRM contact + mapping under the same tenant/account advisory lock as checkout. Never adopt or merge a matching CRM email. The mapping and conversation are created atomically. One WEB conversation per tenant/channel/customer account is resumed across sessions; a closed conversation remains closed until an explicit versioned reopen. First open requires a published store and enabled WEB channel. Existing owned history remains accessible after store unpublication through authenticated customer APIs.

## Seven persistent models

All contain physical tenant_id. Existing migrations remain unchanged. Migration 202611150006_support is additive and uses restrictive references.

| Model | Purpose and constraints |
| --- | --- |
| SupportChannel | Tenant FK; unique tenant/kind and tenant/id. WEB is the only enabled implementation. enabled flag allows operator disablement. |
| Conversation | Tenant/channel composite FK; tenant/contact composite CRM FK; customer User FK. Unique tenant/channel/customer and tenant/id. OPEN/CLOSED, lastSequence, version and timestamps. |
| ConversationParticipant | Composite tenant/conversation FK and User FK. Role CUSTOMER/STAFF/AI, active and monotonically increasing lastReadSequence. Unique tenant/conversation/user/type and tenant/conversation/id. AI is reserved; no AI sending API. |
| Message | Composite tenant/conversation and tenant/conversation/sender-participant FKs. Immutable content <=4000, derived senderType/channel, server sentAt and SENT status. Unique tenant/conversation/sequence and tenant/conversation/participant/clientKey; requestHash rejects changed retries. |
| ConversationAssignment | Composite tenant/conversation FK and assignee/tenant Membership FK. assignedById, assignedAt, endedAt. Partial unique index allows one current assignment per tenant/conversation; historical assignments retained. |
| ConversationEvent | Composite tenant/conversation FK. Authenticated actor, immutable event type/version/timestamp and bounded server-generated payload. Unique tenant/conversation/version. CREATED, MESSAGE_SENT, ASSIGNED/TRANSFERRED, CLOSED/REOPENED events. |
| MessageDelivery | Composite tenant/conversation/message and tenant/conversation/participant FKs. Unique tenant/message/participant. PERSISTED → DELIVERED → READ with receipt timestamps; recipients are actual authorized participants. |

A transaction locks the conversation row before allocating the next integer sequence, checking changed state/version and current authorization, inserting message/deliveries and audit, then commits before notifying. Repeated same-key/same-content send returns the same message ID even after closing; changed content conflicts. Identical retries do not consume new-message rate budget. Concurrent new sends receive distinct contiguous sequence numbers. Status/assignment operations require the current version; one writer wins a race, and the other receives 409. No message mutation or attachment endpoint exists.

## HTTP API

All paths begin /api. Merchant prefix `/tenants/:tenantId/support`; customer prefix `/customer/support`. Every endpoint checks the current session and scoped permission, not a client-provided identity.

| Method | Suffix/path | Contract |
| --- | --- | --- |
| POST | /customer/stores/:slug/support/conversation | {displayName}; create or resume authenticated customer's WEB conversation and CRM link. |
| GET | /conversations | page/pageSize(max100), q(customer name or conversation ID), status OPEN/CLOSED. Merchant Staff scope is current assignments only. Customer scope is own conversations. |
| GET | /conversations/:id | Safe conversation metadata. Merchant DTO includes authorized CRM id/name/email/phone/status/tags and current assignee. Customer DTO excludes tenant, CRM, staff and customer-user IDs. |
| GET | /conversations/:id/messages | after integer sequence (default0), limit(default50,max100). Ascending items, nextAfter, hasMore. Fetch marks actual incoming messages DELIVERED for the authenticated participant. |
| POST | /conversations/:id/messages | {content}, Idempotency-Key (8–128 bounded ASCII). Server-derived sender, WEB channel and sequence; 1–4000 text characters. New messages limited to 30/60s per tenant/account using Redis. |
| POST | /conversations/:id/read | {throughSequence}; bounded by persisted lastSequence, cursor never moves backward; receipt records reflect acknowledged incoming messages. |
| POST | /conversations/:id/assign | Owner/Manager only: {version,assigneeId}, current member of same tenant. End prior assignment and append history atomically. |
| POST | /conversations/:id/close or /reopen | {version}; current authorized participant/operator. Closed conversations cannot accept new messages. |
| GET | /unread | Count only incoming unread messages in the caller's current scope. |
| GET | /agents | Owner/Manager only; current same-tenant members for assignment. |
| GET | /conversations/:id/events | Scoped employee-only last100 safe audit summaries, descending version. No message content/private audit payload in customer responses. |
| POST | /socket-ticket | Empty object; current customer/tenant scope only. Opaque one-use 30-second ticket in Redis, only its hash in the key. Limited to 60/60s per account/scope. |

Mutation origin/custom-header rules remain unchanged. Unknown identity/content fields are rejected. Missing sessions 401; unauthorized scope/role 403 or hidden object 404; invalid shape 400, version/key/closed-state conflict 409, rate limit429. First-open throttled to15/60s per account/store. Message DTO contains ID, sequence, plain content, senderType, WEB channel, SENT status, sentAt, derived isOwn and own-message delivery/read booleans; no internal sender/user/tenant keys.

## WebSocket transport and reconciliation

The Nest HTTP server hosts a `ws` noServer WebSocket endpoint `/api/support/socket?ticket=...`, proxied by each portal's existing same-origin /api rewrite. WSS follows HTTPS. Origin must exactly match ALLOWED_ORIGINS; a cookie alone cannot open a connection. Consume a single-use ticket, then revalidate its server-stored session/user/tenant scope. No persistent token is stored in browser storage. Tickets must be redacted from infrastructure URL logs.

Server ready → client subscribe {conversationId} → reauthorize → subscribed. Each conversation is separately authorized; extra tenant/sender fields and other customers' IDs never grant subscription. Unsubscribe and ping are the only other control operations; messages are sent over the validated HTTP API. Limits: 2 KiB frames, 120 frames/minute per connection, 10 subscriptions and five local-node connections per session, no compression. Backpressure closes the socket for safe reconnect.

Sockets carry invalidation metadata only (changed conversation ID or tenant Inbox invalidation), never private message/CRM payload. The HTTP read path remains authoritative. Every notification revalidates session and conversation permission; reassigned Staff are revoked and cannot recover from an old subscription. A 30-second heartbeat rechecks session validity; logout invalidates subsequent operations/notifications immediately. No online staff availability is inferred from transport connectivity.

Clients request a fresh ticket on reconnect, resubscribe, fetch saved messages after their cursor, refresh recent delivery state, and merge by sequence to deduplicate. Periodic 10-second HTTP reconciliation covers missed notifications, process crashes after commit or a notification outage. UI explicitly distinguishes transport connectivity from merchant availability. There is no in-memory-only message store and no claim of exactly-once network delivery; persisted idempotency plus replay provides exactly one accepted message per scoped key.

The injectable SupportBus separates persistence from notification. Set SUPPORT_REDIS_ADAPTER=true on API instances to enable actual Redis Pub/Sub invalidations with node-origin loop suppression; both instances must share DB/Redis/channel. Default single-node mode is local. Redis carries no message content; consumers reauthorize and read PostgreSQL. A broker outage must not undo a committed message; catch-up remains possible. Sticky sessions are unnecessary for this raw WebSocket protocol; production edge must forward Upgrade headers and use HTTPS/WSS. Connection quotas are per node; global connection quotas and deployment capacity are operational follow-ups, not acceptance claims.

## Interfaces and attachments boundary

Merchant `/inbox`: tenant switching, name/ID search, status filter, pagination, scoped unread totals, conversation window, authorized CRM sidebar/link, current member assignment/transfer, close/reopen, delivery state and safe audit summaries. English/Chinese/Malay and mobile layout reuse existing UI tokens. Old tenant context is unmounted on switching.

Customer store widget: login required, display name to create/resume, actual persisted history, real-time human replies, receipt/send state, close/reopen and reconnect reconciliation. The existing AI placeholder remains explicit that AI is unavailable. No fake online/typing/response-time claims. Unacknowledged send retries retain an opaque scoped key; after acknowledgement, an intentional identical new message uses a fresh key. No message text is stored in browser storage.

Attachments remain closed: no upload route, file picker or arbitrary attachment URL field. A later reviewed implementation must enforce tenant/conversation authorization before parsing, byte/type/content limits, malware/content inspection, private object storage, scoped short-lived download authorization, metadata/filename sanitization and retention. Existing public catalog-image endpoints must never be used for private chat attachments. M2-B AI, external WhatsApp/email channels, bots, attachments, anonymous chat and production deployment are outside M2-A.

## M2-B extension

The subsequent approved AI checkpoint adds optional grounded AI, nullable bot participants and human takeover while retaining the M2-A authorization and transport. See [M2-B design](M2-B-DESIGN.md). Human-only exclusions above describe the original M2-A checkpoint. Live AI acceptance must be reported independently from Mock evaluation.
