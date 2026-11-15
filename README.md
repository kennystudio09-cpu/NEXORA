# NEXORA

AI Business Operating System, Malaysia first. This initial checkpoint is an engineering skeleton, not an accepted M0 release.

## Workspace

- apps/customer-web: Customer Portal (3000)
- apps/merchant-web: Merchant Portal (3001)
- apps/admin-web: Platform Admin (3002)
- apps/api: NestJS API (4000); /health currently checks liveness only
- apps/worker: BullMQ worker; no business handlers registered
- packages/database, auth, ui, shared, ai-core: shared foundations

## Local development

Use Node.js 22+ and pnpm 10.32.1. Run `pnpm install --frozen-lockfile`. Copy `.env.example` to `.env`, set a local password, and export DATABASE_URL/REDIS_URL into the application process environment (Compose reads its own .env). Start PostgreSQL and Redis with `docker compose up -d`. Never run volume deletion or database reset commands.

Run `pnpm db:generate`, then `pnpm db:migrate` once actual domain migrations are present. Run `pnpm dev` to start services and portals. Validate with `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. No application tests or domain migrations are present at this initial checkpoint; a zero-test run is not acceptance.

See VALIDATION.md for historical validation and the latest checkpoint.
