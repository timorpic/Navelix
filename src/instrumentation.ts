export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. 动态载入 EE 商业驱动（运行时动态导入，避免 Turbopack 编译期静态追踪）
    try {
      const dynamicRequire = new Function("m", "return require(m)");
      const path = await import("node:path");
      const fs = await import("node:fs");
      const eeCjsPath = path.resolve(process.cwd(), "ee", "index.cjs");
      if (fs.existsSync(eeCjsPath)) {
        dynamicRequire(eeCjsPath);
      } else {
        const dynamicImport = new Function("s", "return import(s)");
        const eeTsPath = path.resolve(process.cwd(), "ee", "index.ts");
        if (fs.existsSync(eeTsPath)) {
          await dynamicImport(eeTsPath);
        }
      }
    } catch {
      // 社区开源版无 ee 模块，静默降级为 CE 驱动
    }

    // 2. 启动后台守护任务
    const { startBackgroundDaemon } = await import("./lib/daemon");
    startBackgroundDaemon();
  }
}
