# NEXORA development

Use this isolated checkout; do not create worktrees unless requested. Preserve user changes and VALIDATION.md history. Never commit .env, secrets, database files, dependencies, or caches. Never reset databases or remove volumes without explicit approval. Use pnpm and the frozen lockfile. Implement M0 incrementally; test, commit, push without force, and verify the remote SHA at each stable checkpoint. Do not implement M1. Report unrun checks honestly. Tenant access and RBAC must be enforced server-side; never trust client tenantId.
