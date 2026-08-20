export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. 动态载入 EE 商业驱动（统一以 ee/dist/bundle.jsc 二进制字节码为唯一实体）
    try {
      const path = await import("node:path");
      const fs = await import("node:fs");
      const eeJscPath = path.resolve(process.cwd(), "ee", "dist", "bundle.jsc");

      if (fs.existsSync(eeJscPath)) {
        const dynamicRequire = new Function("m", "return require(m)");
        dynamicRequire("bytenode");
        dynamicRequire(eeJscPath);
        console.log("[Navelix EE] 已挂载 EE 商业驱动字节码制品 (ee/dist/bundle.jsc)");
      }
    } catch (err) {
      console.warn("[Navelix EE] 未挂载 EE 驱动，已作为开源社区版 (CE) 运行:", err);
    }

    // 2. 启动后台守护任务
    const { startBackgroundDaemon } = await import("./lib/daemon");
    startBackgroundDaemon();
  }
}
