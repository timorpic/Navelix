# ── Navelix Multi-Stage Production Dockerfile ──
FROM node:22-alpine AS base

# Stage 1: Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

# Stage 2: Builder
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN corepack enable && pnpm build

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3721
ENV HOSTNAME=0.0.0.0

# 构建元数据：用于应用内自检更新（由 GitHub Actions 通过 build-args 注入）
ARG SOURCE_SHA=unknown
ARG BUILD_DATE=unknown
ARG NAVELIX_VERSION=1.0.6
ENV NAVELIX_SOURCE_SHA=$SOURCE_SHA
ENV NAVELIX_BUILD_DATE=$BUILD_DATE
ENV NAVELIX_VERSION=$NAVELIX_VERSION

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3721

CMD ["node", "server.js"]
