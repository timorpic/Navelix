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

ARG SOURCE_SHA=unknown
ARG BUILD_DATE=unknown
ARG NAVELIX_VERSION=2.8.3
ENV NAVELIX_SOURCE_SHA=$SOURCE_SHA
ENV NAVELIX_BUILD_DATE=$BUILD_DATE
ENV NAVELIX_VERSION=$NAVELIX_VERSION

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 烘焙真实物理构建元数据到 public/build-info.json，彻底免疫 Docker/Watchtower 环境变量继承覆盖
RUN mkdir -p public ee && \
    node -e "const fs=require('fs'); fs.writeFileSync('public/build-info.json', JSON.stringify({ version: '$NAVELIX_VERSION', sourceSha: '$SOURCE_SHA', buildDate: '$BUILD_DATE' }));"

# 编译商业 EE 驱动为 V8 字节码并物理销毁全部 .ts 源码明文（仅打包 .jsc 二进制制品，无外部编译脚本依赖）
RUN if [ -f "ee/index.ts" ]; then \
      node -e " \
        const esbuild = require('esbuild'); \
        const bytenode = require('bytenode'); \
        const fs = require('node:fs'); \
        const path = require('node:path'); \
        fs.mkdirSync('ee/dist', { recursive: true }); \
        esbuild.buildSync({ \
          entryPoints: ['ee/index.ts'], \
          bundle: true, \
          platform: 'node', \
          format: 'cjs', \
          target: 'node22', \
          outfile: 'ee/dist/bundle.cjs', \
          minify: true, \
          treeShaking: true, \
          external: ['node:*', 'node:crypto', 'node:fs', 'node:path', 'node:sqlite', 'node:buffer', 'bytenode'] \
        }); \
        bytenode.compileFile({ filename: 'ee/dist/bundle.cjs', output: 'ee/dist/bundle.jsc', compileAsModule: true }); \
        if (fs.existsSync('ee/dist/bundle.cjs')) fs.unlinkSync('ee/dist/bundle.cjs'); \
        const loader = '\"use strict\";\nconst fs=require(\"node:fs\");\nconst path=require(\"node:path\");\nconst dyn=new Function(\"m\",\"return require(m)\");\nconst jsc=path.join(__dirname,\"dist\",\"bundle.jsc\");\nif(fs.existsSync(jsc)){dyn(\"bytenode\");dyn(jsc);}'; \
        fs.writeFileSync('ee/index.cjs', loader, 'utf8'); \
        fs.writeFileSync('ee/index.js', loader, 'utf8'); \
      "; \
    fi && \
    find ee -name "*.ts" -delete 2>/dev/null || true

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

# 彻底清理 standalone 内可能残留的任何源码文件并补齐 bytenode 运行时依赖
# （复制 bytenode 后物理删除其包内所有 .d.ts 类型声明与 .ts 文件，确保容器零 .ts）
RUN rm -rf /app/.next/standalone/ee && \
    find /app/.next/standalone -name "*.ts" -delete 2>/dev/null || true && \
    for BYTENODE_SRC in /app/node_modules/.pnpm/bytenode@*/node_modules/bytenode /app/node_modules/bytenode; do \
      if [ -d "$BYTENODE_SRC" ]; then \
        mkdir -p /app/.next/standalone/node_modules/bytenode && \
        cp -r "$BYTENODE_SRC"/* /app/.next/standalone/node_modules/bytenode/; \
        find /app/.next/standalone/node_modules/bytenode -name "*.ts" -delete 2>/dev/null || true; \
        break; \
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
ARG NAVELIX_VERSION=2.8.3
ENV NAVELIX_SOURCE_SHA=$SOURCE_SHA
ENV NAVELIX_BUILD_DATE=$BUILD_DATE
ENV NAVELIX_VERSION=$NAVELIX_VERSION

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/ee ./ee

USER nextjs

EXPOSE 3721

CMD ["node", "server.js"]
