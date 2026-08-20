import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const eeDir = path.join(rootDir, "ee");
const eeIndexTs = path.join(eeDir, "index.ts");

async function compileEE() {
  if (!fs.existsSync(eeIndexTs)) {
    console.log("[compile-ee] No ee/index.ts found. Skipping EE compilation (CE mode).");
    return;
  }

  console.log("[compile-ee] Compiling EE commercial module into V8 Bytecode...");
  const esbuild = await import("esbuild");
  const bytenode = require("bytenode");

  const distDir = path.join(eeDir, "dist");
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const bundleCjsPath = path.join(distDir, "bundle.cjs");
  const bundleJscPath = path.join(distDir, "bundle.jsc");

  // 1. Bundle TypeScript to a standalone CommonJS file using esbuild
  await esbuild.build({
    entryPoints: [eeIndexTs],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    outfile: bundleCjsPath,
    minify: true,
    treeShaking: true,
    sourcemap: false,
    external: [
      "node:*",
      "node:crypto",
      "node:fs",
      "node:path",
      "node:sqlite",
      "node:buffer",
      "bytenode",
    ],
  });

  // 2. Compile bundle.cjs to V8 Bytecode (.jsc)
  bytenode.compileFile({
    filename: bundleCjsPath,
    output: bundleJscPath,
    compileAsModule: true,
  });

  // 3. Remove intermediate CJS bundle
  if (fs.existsSync(bundleCjsPath)) {
    fs.unlinkSync(bundleCjsPath);
  }

  // 4. Create clean loader ee/index.cjs & ee/index.js
  const loaderContent = `"use strict";
const fs = require("node:fs");
const path = require("node:path");
const dynamicRequire = new Function("m", "return require(m)");

const jscPath = path.join(__dirname, "dist", "bundle.jsc");
if (fs.existsSync(jscPath)) {
  dynamicRequire("bytenode");
  dynamicRequire(jscPath);
} else {
  console.warn("[Navelix EE] Bytecode bundle.jsc not found");
}
`;
  fs.writeFileSync(path.join(eeDir, "index.cjs"), loaderContent, "utf8");
  fs.writeFileSync(path.join(eeDir, "index.js"), loaderContent, "utf8");

  // 5. If running in production Docker build, purge all .ts files from ee/
  if (process.env.PURGE_EE_TS === "true") {
    console.log("[compile-ee] PURGE_EE_TS active: deleting all .ts source files from ee/");
    const deleteTsFiles = (dir) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
          if (item !== "dist") deleteTsFiles(full);
        } else if (item.endsWith(".ts")) {
          fs.unlinkSync(full);
        }
      }
    };
    deleteTsFiles(eeDir);
  }

  console.log("[compile-ee] Successfully compiled EE into V8 Bytecode (bundle.jsc)!");
}

compileEE().catch((err) => {
  console.error("[compile-ee] Error compiling EE module:", err);
  process.exit(1);
});
