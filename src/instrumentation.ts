export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. 动态载入 EE 商业驱动（运行时动态导入，避免 Turbopack 编译期静态追踪）
    try {
      const path = await import("node:path");
      const fs = await import("node:fs");
      const { pathToFileURL } = await import("node:url");
      const eeDir = path.resolve(process.cwd(), "ee");
      const eeTsPath = path.join(eeDir, "index.ts");
      const eeCjsPath = path.join(eeDir, "index.cjs");

      if (fs.existsSync(eeTsPath)) {
        const dynamicImport = new Function("s", "return import(s)");
        await dynamicImport(pathToFileURL(eeTsPath).href);
        console.log("[Navelix EE] 已挂载本地开发版 EE 商业驱动源码 (ee/index.ts)");
      } else if (fs.existsSync(eeCjsPath)) {
        const dynamicRequire = new Function("m", "return require(m)");
        dynamicRequire(eeCjsPath);
        console.log("[Navelix EE] 已挂载生产编译版 EE 商业驱动制品 (ee/dist/bundle.jsc)");
      }
    } catch (err) {
      console.warn("[Navelix EE] 未挂载 EE 驱动，已作为开源社区版 (CE) 运行:", err);
    }

    // 2. 启动后台守护任务
    const { startBackgroundDaemon } = await import("./lib/daemon");
    startBackgroundDaemon();
  }
}
