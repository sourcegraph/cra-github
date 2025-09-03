# AGENTS.md

## Build/Lint/Test Commands
- **Build**: `pnpm run build` (TypeScript to dist/)
- **Lint**: `pnpm run lint` (ESLint on src/**/*.ts)
- **Type check**: `pnpm run type-check` (tsc --noEmit)
- **Test**: `pnpm run test` (Vitest)
- **Dev**: `pnpm run dev` (tsx watch src/server.ts)
- **MCP Server**: `pnpm run mcp` or `pnpm run mcp:build`

## Architecture
- **GitHub Code Review Agent** using Hono.js framework
- **Main components**: GitHub webhook processing, review queue, AI-powered code analysis
- **Key directories**: src/github/ (auth, webhooks), src/review/ (queue, reviewer), src/mcp/ (Model Context Protocol)
- **External integrations**: GitHub App API, Amp for AI reviews
- **Configuration**: config.yml with environment variable interpolation

## Code Style
- **TypeScript ES2020 modules** with strict mode
- **Imports**: Use .js extensions for local imports, group external first
- **Error handling**: No explicit-any warnings, unused vars are errors
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Files**: kebab-case for filenames (review-queue.ts, webhook-manager.ts)
- **Formatting**: ESLint config enforces prefer-const, no-var
