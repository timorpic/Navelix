/**
 * 组件测试的 JSX 装载器。
 *
 * 测试用 `node --experimental-strip-types` 运行，它只能剥类型、**不转换 JSX**，
 * 因此 `.tsx` 组件无法被直接 import。此处在运行时用 esbuild（已是构建期依赖，
 * 见 Dockerfile 的 EE 字节码编译）把组件编译为 ESM 后加载，无需引入测试框架。
 *
 * 用法：
 *   const { render, screen } = await loadTsx("src/components/ai-breakdown-card.tsx");
 *
 * 说明：
 * - `@/` 别名按 tsconfig 的 `paths` 映射到 `src/`，与打包器保持一致；
 * - 依赖 `jsdom` 提供 DOM，`react-dom/client` 负责渲染；
 * - 每个测试文件通过 `setupDom()` 建立全局环境，`teardownDom()` 清理。
 */

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

/** 建立 jsdom 全局环境（DOM 相关测试文件在 before 钩子里调用一次）。 */
export async function setupDom(): Promise<void> {
  const { JSDOM } = require("jsdom") as typeof import("jsdom");
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost:3000",
    pretendToBeVisual: true,
  });

  // Node 22 的 globalThis 上部分属性（如 navigator）是只读 getter，
  // 直接赋值会抛 TypeError，因此统一走 defineProperty 覆盖。
  const define = (key: string, value: unknown) => {
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  };
  define("window", dom.window);
  define("document", dom.window.document);
  define("navigator", dom.window.navigator);
  define("HTMLElement", dom.window.HTMLElement);
  define("HTMLInputElement", dom.window.HTMLInputElement);
  define("HTMLSelectElement", dom.window.HTMLSelectElement);
  define("HTMLTextAreaElement", dom.window.HTMLTextAreaElement);
  define("Element", dom.window.Element);
  define("Node", dom.window.Node);
  define("Event", dom.window.Event);
  define("CustomEvent", dom.window.CustomEvent);
  define("MouseEvent", dom.window.MouseEvent);
  define("KeyboardEvent", dom.window.KeyboardEvent);
  define("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));
  define("requestAnimationFrame", dom.window.requestAnimationFrame.bind(dom.window));
  define("cancelAnimationFrame", dom.window.cancelAnimationFrame.bind(dom.window));
  // React 18+ 通过该标志判断是否已支持并发特性
  define("IS_REACT_ACT_ENVIRONMENT", true);

  // 组件常用到但 jsdom 未实现的 API
  if (!dom.window.matchMedia) {
    (dom.window as unknown as Record<string, unknown>).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}

/** 清理全局 DOM 环境。 */
export function teardownDom(): void {
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "Element",
    "Node",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "KeyboardEvent",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT",
  ]) {
    delete (globalThis as unknown as Record<string, unknown>)[key];
  }
}

/** tsconfig 的 `@/` 别名 → 仓库根的 `src/`。 */
function resolveAlias(specifier: string): string {
  if (!specifier.startsWith("@/")) return specifier;
  const base = path.join(ROOT, "src", specifier.slice(2));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return base;
}

/**
 * 只处理 `@/` 别名；其余路径（相对路径、node_modules）交给 esbuild 自身的
 * 解析器 —— 它知道相对路径要基于**导入方**所在目录解析，手写容易搞错。
 */
const tsxPlugin = {
  name: "alias-loader",
  setup(build: {
    onResolve: (
      filter: { filter: RegExp },
      cb: (args: { path: string }) => { path: string; namespace: string },
    ) => void;
    onLoad: (
      filter: { filter: RegExp; namespace: string },
      cb: (args: { path: string }) => { contents: string; loader: string },
    ) => void;
  }) {
    build.onResolve({ filter: /^@\// }, (args) => ({
      path: resolveAlias(args.path),
      namespace: "alias-src",
    }));
    build.onLoad({ filter: /.*/, namespace: "alias-src" }, (args) => ({
      contents: fs.readFileSync(args.path, "utf8"),
      loader: args.path.endsWith(".tsx") ? "tsx" : "ts",
    }));
  },
};

interface CompiledComponent {
  default: (props: Record<string, unknown>) => unknown;
  [key: string]: unknown;
}

const cache = new Map<string, CompiledComponent>();

/**
 * 编译并加载一个 .tsx 组件（或其依赖的 .ts 模块）。
 *
 * 编译结果写到 `.next/tsx-test-cache/`，避免污染源码目录；同一路径只编译一次。
 */
export async function loadTsx(relPath: string): Promise<CompiledComponent> {
  const abs = path.resolve(ROOT, relPath);
  const cached = cache.get(abs);
  if (cached) return cached;

  const esbuild = require("esbuild") as typeof import("esbuild");
  const outDir = path.join(ROOT, ".next", "tsx-test-cache");
  fs.mkdirSync(outDir, { recursive: true });
  const outfile = path.join(outDir, `${path.basename(abs)}.${hash(abs)}.mjs`);

  await esbuild.build({
    entryPoints: [abs],
    bundle: true,
    outfile,
    format: "esm",
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    // React 与 react-dom 走 node_modules 解析，不打进产物
    external: ["react", "react-dom", "react/jsx-runtime", "react-dom/client"],
    plugins: [tsxPlugin as never],
    logLevel: "silent",
  });

  const mod = (await import(pathToFileURL(outfile).href)) as CompiledComponent;
  cache.set(abs, mod);
  return mod;
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
