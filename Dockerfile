# Build stage
FROM node:20-alpine AS builder

RUN corepack enable
WORKDIR /app

# Copy package files and install all dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build

# Runtime stage
FROM node:20-alpine

RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5053 \
    GITHUB_APP_CWD=/app

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy built application and config
COPY --from=builder /app/dist ./dist
COPY config.yml ./

EXPOSE 5053

# Ensure container runs from /app regardless of external --workdir overrides
ENTRYPOINT ["sh", "-c", "cd /app && exec \"$@\"", "--"]

# Default: start webhook server for Docker deployments  
# Note: GitHub Actions overrides this CMD with review-action.js
CMD ["node", "dist/server.js"]
