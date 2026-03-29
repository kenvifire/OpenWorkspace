# ─────────────────────────────────────────────────────────────
# Stage 1: Builder
# Installs all deps and compiles the NestJS app from the monorepo root
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package manifests for all workspace members that api depends on
COPY packages/shared/package.json         ./packages/shared/
COPY packages/api-types/package.json      ./packages/api-types/
COPY packages/ui/package.json             ./packages/ui/
COPY apps/api/package.json                ./apps/api/

# Install all dependencies (workspace-aware, production + dev needed for build)
RUN pnpm install --frozen-lockfile --filter api...

# Copy source for packages consumed by api
COPY packages/shared/   ./packages/shared/
COPY packages/api-types/ ./packages/api-types/

# Copy the api application source
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN pnpm --filter api exec prisma generate

# Compile TypeScript
RUN pnpm --filter api build

# ─────────────────────────────────────────────────────────────
# Stage 2: Production runner
# Lean image — only compiled output and production node_modules
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json         ./packages/shared/
COPY packages/api-types/package.json      ./packages/api-types/
COPY packages/ui/package.json             ./packages/ui/
COPY apps/api/package.json                ./apps/api/

# Install production-only dependencies
RUN pnpm install --frozen-lockfile --filter api... --prod

# Copy compiled output from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema and regenerate the client for the production deps
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
RUN pnpm --filter api exec prisma generate

# Copy nest-cli.json needed by the NestJS runtime path resolver
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json

WORKDIR /app/apps/api

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "dist/main"]
