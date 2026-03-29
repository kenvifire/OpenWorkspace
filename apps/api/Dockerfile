# ─────────────────────────────────────────────────────────────
# Stage 1: Builder — compile TypeScript and generate Prisma client
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json         ./packages/shared/
COPY packages/api-types/package.json      ./packages/api-types/
COPY packages/ui/package.json             ./packages/ui/
COPY apps/api/package.json                ./apps/api/

# Install all dependencies (dev included — needed for prisma CLI and build)
RUN pnpm install --frozen-lockfile --filter api...

# Copy source
COPY packages/shared/   ./packages/shared/
COPY packages/api-types/ ./packages/api-types/
COPY apps/api/ ./apps/api/

# Generate Prisma client and compile TypeScript
RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

# ─────────────────────────────────────────────────────────────
# Stage 2: Production runner
# Re-uses the builder's node_modules (avoids guessing .prisma path)
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

# Full install so prisma CLI is available to generate the client
RUN pnpm install --frozen-lockfile --filter api...

# Copy source packages needed at runtime
COPY packages/shared/   ./packages/shared/
COPY packages/api-types/ ./packages/api-types/

# Copy compiled output and Prisma schema from builder
COPY --from=builder /app/apps/api/dist    ./apps/api/dist
COPY --from=builder /app/apps/api/prisma  ./apps/api/prisma
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json

# Generate Prisma client against the production node_modules
RUN pnpm --filter api exec prisma generate

WORKDIR /app/apps/api

EXPOSE 3001
ENV NODE_ENV=production

CMD ["node", "dist/main"]
