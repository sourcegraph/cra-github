# AGENTS.md

## Build/Lint/Test Commands
- **Build**: `pnpm run build` (TypeScript compilation via build script)
- **Lint**: `pnpm run lint` (ESLint on src/**/*.ts)
- **Type check**: `pnpm run type-check` (tsc --noEmit)
- **Test**: `pnpm run test` (Vitest)
- **Dev**: `pnpm run dev` (tsx watch src/server.ts with predev build)
- **Start**: `pnpm run start` (node dist/server.js)

## Architecture
- **GitHub Code Review Agent** using Hono.js framework and Node.js
- **Main components**: GitHub App integration, webhook processing, review queue, AI-powered code analysis
- **Key directories**: 
  - `src/github/` (GitHub App auth, webhooks)
  - `src/review/` (review queue, reviewer logic)
  - `src/routes/` (API endpoints)
  - `toolbox/` (Amp toolbox scripts)
  - `scripts/` (build scripts)
- **External integrations**: GitHub App API, Amp for AI reviews
- **Configuration**: config.yml with environment variable interpolation

## Code Style
- **TypeScript ES2020 modules** with strict mode, declarations enabled
- **Imports**: ES2020 module resolution with synthetic default imports
- **Error handling**: 
  - `@typescript-eslint/no-explicit-any`: warn
  - `@typescript-eslint/no-unused-vars`: error
  - `prefer-const`, `no-var`: error
- **Naming**: camelCase for variables/functions, PascalCase for types/classes
- **Files**: kebab-case for filenames preferred
- **Build**: Custom build script in scripts/ directory, outputs to dist/

## Environment Setup
- Node.js >=18.0.0 required
- Environment variables configured via `.env` (copy from `.env.example`)
- GitHub App private key required (file-based or base64 encoded)
- Docker/Podman support with docker-compose.yml

## Project Structure
- **Entry point**: src/server.ts
- **Config**: config.yml with queue settings, review rules, Amp integration
- **Toolbox**: AI agent tools for GitHub operations (comment management)
- **Build output**: dist/ directory (excluded from TypeScript compilation)
