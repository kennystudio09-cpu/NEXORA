# NEXORA development

Use this isolated checkout; do not create worktrees unless requested. Preserve user changes and VALIDATION.md history. Never commit .env, secrets, database files, dependencies, or caches. Never reset databases or remove volumes without explicit approval. Use pnpm and the frozen lockfile. Preserve M0 and implement the user-authorized M1 modules incrementally; test, commit, push without force, and verify the remote SHA at each stable checkpoint. Implement M1 in A/B/C/D order; finish and validate each module before starting the next. Never run business migrations against production. Report unrun checks honestly. Tenant access and RBAC must be enforced server-side; never trust client tenantId.

Current authorized checkpoint: M2-A human customer support and realtime chat. Preserve M0/M1. Do not start M2-B AI support or real payment integration without a new user instruction.
