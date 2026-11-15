import tseslint from "typescript-eslint";
export default tseslint.config(...tseslint.configs.recommended, { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.next-e2e/**", "**/next-env.d.ts", "**/.turbo/**"] });
