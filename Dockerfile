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

# 修复: Next.js standalone + pnpm 缺失 @swc/helpers/esm (Next.js 16.3.x 追踪 bug)
# standalone 输出常缺少 @swc/helpers 的 esm/ 目录，导致容器启动时
# require-handler 无法加载 _interop_require_default.js。这里按版本精确补齐。
RUN for SWC_DIR in /app/.next/standalone/node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers; do \
      if [ -d "$SWC_DIR" ] && [ ! -d "$SWC_DIR/esm" ]; then \
        SWC_VERSION=$(echo "$SWC_DIR" | sed -E 's#.*/@swc\+helpers@([^/]+)/.*#\1#'); \
        for SRC_DIR in /app/node_modules/.pnpm/@swc+helpers@*"/node_modules/@swc/helpers"; do \
          SRC_VERSION=$(echo "$SRC_DIR" | sed -E 's#.*/@swc\+helpers@([^/]+)/.*#\1#'); \
          if [ "$SRC_VERSION" = "$SWC_VERSION" ] && [ -d "$SRC_DIR/esm" ]; then \
            echo "Fixing @swc/helpers@$SWC_VERSION: copying esm/ into standalone"; \
            cp -r "$SRC_DIR/esm" "$SWC_DIR/esm"; \
            break; \
          fi; \
        done; \
      fi; \
    done

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
