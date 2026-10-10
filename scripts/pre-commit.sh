#!/bin/sh
# pre-commit 门禁：类型检查 + lint。
#
# 本仓库可能在两种环境下被提交：
#   1. 已安装 Node 24 + pnpm 的开发机 —— 直接跑 `pnpm precommit`。
#   2. 仅挂载了仓库的容器化/精简环境（宿主机无 node/pnpm）—— 退回到
#      node:24-alpine 容器执行，复用仓库内已安装的 node_modules。
# 两者都不满足时以非零码失败并提示安装方式，避免只能整体跳过门禁。
#
# 与 CI 的关系：这里只跑类型与 lint，覆盖率、构建与 E2E 仍由 CI 负责。

set -e

if [ "$SKIP_SIMPLE_GIT_HOOKS" = "1" ]; then
  echo "[pre-commit] SKIP_SIMPLE_GIT_HOOKS=1，跳过门禁。"
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if command -v pnpm >/dev/null 2>&1; then
  echo "[pre-commit] 使用本机 pnpm 执行 pnpm precommit..."
  exec pnpm precommit
fi

if command -v docker >/dev/null 2>&1; then
  echo "[pre-commit] 本机无 pnpm，回退到 node:24-alpine 容器执行..."
  exec docker run --rm -v "$repo_root":/app -w /app node:24-alpine \
    sh -c './node_modules/.bin/tsc --noEmit --noUnusedLocals --noUnusedParameters && ./node_modules/.bin/eslint'
fi

echo "[pre-commit] 既无 pnpm 也无 docker，无法执行类型检查与 lint。" >&2
echo "[pre-commit] 请安装 Node 24 + pnpm，或使用 SKIP_SIMPLE_GIT_HOOKS=1 显式跳过。" >&2
exit 1
