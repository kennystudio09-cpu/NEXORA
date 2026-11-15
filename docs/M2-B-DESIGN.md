# M2-B grounded AI support and tenant knowledge

Branch: feature/m2-ai-support. Base: verified/pushed M2-A 8ce4bc78c27c6d8eba65b6e7c8ffe0628c8be96b. Preserve all existing portals, CRM, Catalog, Orders, Inbox and WebSocket behavior. No M2-C, payment/refund/order action, attachment or external channel is added.

## Provider and grounding boundary

`packages/ai-core` defines AIProvider, bounded evidence selection, language/retrieval/safety helpers and the server-only OpenAI Responses adapter. `apps/api/src/ai.service.ts` owns configuration, quota, durable execution and message integration; AIKnowledge owns tenant-scoped FAQ/index and public facts. Business logic consumes the adapter interface, not provider-specific response objects. OpenAI requests use the fixed HTTPS endpoint, server OPENAI_API_KEY and OPENAI_MODEL (default gpt-4.1-mini), store=false, tools=[], bounded output and strict JSON schema. No endpoint accepts a key, base URL, model override, tool or sender identity.

The model chooses only allowed evidence IDs and a needsHuman boolean. It does **not** generate the final customer answer or SQL. Validate output shape/IDs, reject tool-call output and unknown IDs, then render complete canonical facts and numbered citations on the server. Whole facts are fitted under the message bound; facts are never cut mid-policy. Model-generated prices, stock and order state cannot enter an accepted answer. The only catalog price answers come from current ACTIVE, nondeleted tenant items/active variants and exact Decimal strings. No stock, private orders, CRM profile or complete conversation history is fetched for the model.

Latest question only (maximum600 characters) goes to the adapter after common email/telephone/long-number redaction. Evidence is approved FAQ text and allowlisted public profile/catalog fields. Persona tone is a bounded enum and changes only a localized, non-factual greeting; verified evidence is preserved verbatim. free-form welcome text is displayed as merchant-authored text, not a system prompt. Untrusted content is always data. Injection-like FAQ content is rejected; instruction-like queries, complaints/refunds/payment disputes, inventory/order-state inquiries and explicit human requests bypass the model. No reliable lexical evidence or model uncertainty transfers to humans. This conservative boundary is not a claim of general semantic correctness; live model acceptance is separate.

## Additive data model

Migration 202611150007_ai_support creates seven tenant-scoped models with composite tenant/parent references. Prior six migrations/data remain intact.

| Model | Data and constraints |
| --- | --- |
| AIAgent | One per tenant; name, welcome, PROFESSIONAL/FRIENDLY/CONCISE tone, en/zh/ms default language, revision and timestamps. Tenant/id composite unique. |
| AIAgentVersion | Immutable tenant/agent/revision, authenticated actor, action, bounded configuration or document-revision snapshot. Composite tenant/agent FK; unique tenant/agent/revision. Includes config changes and FAQ creation/update/archive/reindex revisions. |
| AISettings | Tenant PK and composite agent FK. enabled=false, autoReply=false, HUMAN_FIRST default or AI_FIRST, monthly token budget, requests/min, UTC period, used/conservatively charged and reserved tokens. SQL budget/rate bounds. |
| AIUsageRecord | Composite tenant/agent, optional tenant/conversation and tenant/conversation/trigger-message FKs. Unique tenant/trigger and tenant/actor/requestKey. Agent revision, AUTO/PLAYGROUND kind, PENDING/RUNNING/SUCCEEDED/HANDOFF/SKIPPED, reason, provider/model, prompt hash, language, token counts/usageKnown, reservation, latency/attempts, nullable Decimal USD estimate, safe evidence snapshots and timestamps. Raw prompts/provider bodies/keys are not recorded. |
| KnowledgeBase | Tenant/name unique; composite tenant/id. Initial Support base created lazily. |
| KnowledgeDocument | Tenant/base composite FK; title, manually verified questions/answers in all three languages, ACTIVE/ARCHIVED status, revision, actor and timestamps. Up to100 active FAQs. Archive is soft deletion. |
| KnowledgeChunk | Composite tenant/document FK, revision, language, bounded search text/answer, active flag; unique tenant/document/revision/language. Each edit/reindex deactivates old chunks and appends three new chunks, preserving old content. |

Conversation gains aiHumanRequired, aiState and aiGeneration. Message gains citations JSON. ConversationParticipant.userId becomes nullable so a bot has an actual AI participant, not a fabricated employee/customer account; a partial unique index permits one AI participant per tenant/conversation. Existing human participants remain unchanged. AI incoming messages participate in unread/read/delivery accounting despite their null user ID.

## Retrieval and knowledge operations

Use bounded lexical matching of English/Malay words and Chinese bigrams, with stopwords and a conservative relevance threshold, maximum three candidate facts. No pgvector dependency or unverified extension is introduced. FAQs are explicitly for customer-facing support; all language variants must be supplied by the merchant, not silently machine-translated. Owner/Manager are responsible for approved source truth. Search is always filtered by tenant, active chunk and active document; prior revisions and archived content are excluded.

Published merchant profile contributes real hours, address and phone/email with localized field labels. Catalog contributes actual item/variant name and currency/price strings, excluding draft/archived/deleted/inactive entries, internal SKU and private tenant settings. Queries about price use catalog facts only. No private merchant records or other tenant sources can be requested by client IDs.

Before a customer reply is committed, check the source fingerprint again. Finalization takes configuration/source/conversation locks, re-reads current facts, agent revision, generation and latest trigger sequence. Changed price/knowledge, human takeover/reply/assignment, disabling settings, closing the thread or a newer customer message cancels obsolete output. No stale reply is blindly appended after an external call.

## Durable workflow, quotas and failure states

Customer send commits a unique PENDING usage job in the **same** transaction as the existing Message/history event when automatic AI is enabled. Existing scoped message idempotency returns before enqueue, so retries cannot create another job. A database-backed API scheduler claims PENDING → RUNNING by CAS; multiple instances cannot claim the same job. Jobs are filtered by adapter identity. No provider work occurs inside the message acceptance transaction.

HUMAN_FIRST defers to the human team. Assignment, an employee reply, customer human request or any safety/provider failure sets sticky human takeover. Existing assigned human rooms are preserved. Only a current Owner/Manager can explicitly allow AI again; assignment permissions are retained while the explicit override permits AI_FIRST. Generations prevent an in-flight result surviving takeover. Customers cannot resume AI or mutate its settings. Takeover requests appear in the existing Owner/Manager Inbox; they do not pretend an employee has already been assigned or is online.

Redis enforces configured per-tenant requests/min and a two-call shared provider concurrency lease with expiry; the adapter also caps two in-process calls. Atomically reserve a conservative token bound covering two attempts under a tenant budget advisory lock before calling the provider. Quota is UTC-month based and does not reset while reservations remain outstanding. Retry at most once on429/5xx; per-attempt deadline defaults8s (AI_TIMEOUT_MS, bounded1–15s). No retries on timeouts/unsafe output. On failure, release reservations and charge uncertain calls conservatively; an expired RUNNING lease becomes INTERRUPTED/human handoff without blindly replaying a potentially billed request.

Successful provider-reported usage records input/output tokens and latency/attempts. Unknown usage is marked usageKnown=false, cost=null and displayed as Unknown. Estimates use Decimal and a documented reference rate for gpt-4.1-mini ($0.40/input million, $1.60/output million); unknown models/providers have null estimates. Estimates describe reported successful usage, not an invoice; retries can have uncertain earlier usage and debit additional conservative budget. Mock runs are named mock-evaluation/mock-e2e and have no fabricated OpenAI cost.

Final AI message, citation snapshots, recipient deliveries, conversation sequence/version, AI_REPLIED audit event and job terminal state are one transaction. Handoffs append AI_HANDOFF. Notify through the unchanged SupportBus/WebSocket invalidation path only after commit; clients load authorized saved history. No fake AI reply is written on absent key, timeout, rate/quota/busy state, unsupported query or uncertain evidence.

## HTTP API and UI

All AI-management routes start `/api/tenants/:tenantId/ai`, authenticated Owner/Manager only. Staff/other tenants/ordinary customer accounts cannot read or mutate management, knowledge or logs. Unknown body fields (tenantId/key/provider/tool/model) are rejected.

| Method | Suffix | Contract |
| --- | --- | --- |
| GET/PATCH | /settings | Safe config/provider name+model+configured boolean; update all bounded persona/priority/quota fields with current revision. No secrets. |
| GET | /versions | Last50 immutable safe configuration/document audit snapshots. |
| GET/POST | /documents | Last100 active FAQs/create title + questions {en,zh,ms} + answers {en,zh,ms}. |
| PATCH/DELETE | /documents/:id | Same-tenant edit with revision; archive with revision, preserving old chunks. |
| POST | /documents/:id/reindex | Empty object; append a new validated index revision. |
| POST | /search | {question,language}; allowlisted current evidence without a provider call. Works without a key; this is not AI generation. |
| POST | /playground | Same input + Idempotency-Key; explicit provider test, subject to quota/rate/concurrency even if automatic replies are off. Returns execution status and accepted evidence; never creates a customer message. |
| GET | /usage | Safe last50 runs plus current budget counters; no raw customer prompt, provider error body, credential or complete customer profile. |

Existing authorized customer/merchant support prefixes add POST `/conversations/:id/human` (empty object) and `/ai-resume` (empty object; Owner/Manager only). Both audit, increment generation and notify. Existing conversation DTO adds safe AI name/welcome/enabled/available/state; existing message DTO adds citations and senderType=AI. Runtime cannot select a mock provider over HTTP.

Merchant `/ai`: settings, FAQ edit/archive/reindex, retrieval/Playground, budget/logs and audit; tenant switching clears scope. Inbox adds authorized human/AI takeover controls. Customer Widget identifies AI separately from Human agent, shows configured/unavailable/queued/human-wait states and a human-request button. Three-language labels and mobile layout. Connectivity is not agent presence; missing key is never called successful AI.

## Test separation and operational boundary

`pnpm test` includes existing business/support regressions and explicitly Mock AI evaluations with actual PostgreSQL/Redis. `pnpm test:ai` runs the focused Mock/transport/safety/cost/concurrency suite. A mocked HTTP transport verifies Responses schema/timeout/retry/tool rejection; it is not a real OpenAI test.

`pnpm test:e2e` runs real browser workflows against the normal OpenAI adapter and real **no-key** fallback in this environment. `pnpm test:e2e:ai-mock` runs a separate mock-only browser file; the loopback/nonproduction test startup wrapper injects a clearly named mock provider. Production startup never reads that test flag. Mock messages are explicitly evaluation data, not evidence of live model integration.

`pnpm test:ai:live` calls the actual fixed OpenAI endpoint with synthetic noncustomer facts in three languages if a server key exists. Without a key it writes ignored `test-results/ai-live-result.json` with attempted=false/status=BLOCKED and exits2; no successful AI is invented. Configure OPENAI_API_KEY through the server secret mechanism and rerun live verification before declaring M2-B fully accepted. TLS/egress/API access/billing/model availability must also work. M2-C is not authorized.
