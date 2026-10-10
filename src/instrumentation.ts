export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // 1. 动态载入 EE 商业驱动（统一以 ee/dist/bundle.jsc 二进制字节码为唯一实体）
    // 注意：使用 process.getBuiltinModule 绕过 Next.js / Turbopack 编译期静态 AST 依赖追踪
    try {
      const path = await import("node:path");
      const fs = await import("node:fs");
      const eeJscRelative = "./ee/dist/bundle.jsc";
      const eeJscPath = path.resolve(process.cwd(), "ee", "dist", "bundle.jsc");

      if (fs.existsSync(eeJscPath)) {
        const proc = globalThis.process as unknown as { getBuiltinModule?: (m: string) => { createRequire?: (p: string) => (id: string) => unknown } };
        const moduleMod = proc?.getBuiltinModule ? proc.getBuiltinModule("node:module") : null;
        if (moduleMod?.createRequire) {
          const req = moduleMod.createRequire(path.resolve(process.cwd(), "package.json"));
          req("bytenode");
          req(eeJscRelative);
          console.log("[Navelix EE] 已挂载 EE 商业驱动字节码制品 (ee/dist/bundle.jsc)");
        }
      } else {
        console.log("[Navelix EE] 未检测到 EE 商业驱动，当前以开源社区版 (CE) 运行");
      }
    } catch (err) {
      // 制品存在但加载失败，属于配置/构建问题，而非「本就没有 EE」。
      // 最常见原因是 bundle.jsc 由不同 V8 版本编译：V8 字节码与编译时的
      // Node/V8 版本强绑定，跨版本加载会抛 cachedDataRejected，表现为
      // 镜像里带了 EE 制品却静默退回 CE。此处直接点名原因，避免与
      // 「未检测到制品」的正常 CE 情形混淆。
      const detail = err instanceof Error ? err.message : String(err);
      const hint = /cachedDataRejected|Invalid or incompatible cached data/i.test(detail)
        ? "（字节码与当前 Node/V8 版本不匹配：请在目标 Node 版本下用 ee/compile.mjs 重新编译 ee/dist/bundle.jsc）"
        : "";
      console.error(
        `[Navelix EE] 已检测到 EE 制品但加载失败，本次以开源社区版 (CE) 运行${hint}: ${detail}`,
      );
    }

    // 2. 启动后台守护任务
    const { startBackgroundDaemon } = await import("./lib/daemon");
    startBackgroundDaemon();
  }
}
