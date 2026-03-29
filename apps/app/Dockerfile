# ─────────────────────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Copy workspace manifests for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json     ./packages/shared/
COPY packages/api-types/package.json  ./packages/api-types/
COPY packages/ui/package.json         ./packages/ui/
COPY apps/app/package.json            ./apps/app/

RUN pnpm install --frozen-lockfile --filter app...

# Copy source
COPY packages/shared/   ./packages/shared/
COPY packages/api-types/ ./packages/api-types/
COPY packages/ui/       ./packages/ui/
COPY apps/app/          ./apps/app/

# Build Next.js (standalone output)
# Firebase env vars must be set at build time (NEXT_PUBLIC_ vars are inlined by Next.js)
# Pass real values via --build-arg in production; defaults allow CI/Docker image builds to succeed
ARG NEXT_PUBLIC_FIREBASE_API_KEY=placeholder-api-key
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=placeholder.firebaseapp.com
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=placeholder-project
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=placeholder.appspot.com
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
ARG NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:placeholder
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

WORKDIR /app/apps/app
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ─────────────────────────────────────────────────────────────
# Stage 2: Production runner
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/apps/app/public ./public

# Leverage Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
