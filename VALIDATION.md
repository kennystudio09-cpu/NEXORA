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
