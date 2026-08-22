import type { DatabaseSync } from "node:sqlite";

/**
 * v8：一次性迁移 —— 更新 UI 设计图标库的描述说明，包含中文友好/商用授权提示。
 */
export function migrateV8(db: DatabaseSync): void {
  const iconUpdates: Array<{ id: string; desc: string }> = [
    { id: "iconpark-cat", desc: "字节开源图标库，完全免费商用，线性/面性/双色，可调描边圆角" },
    { id: "iconfont", desc: "阿里矢量图标库，海量资源、支持改色与团队库（需注意筛选免费商用标签）" },
    { id: "qingicon", desc: "国产 B 端开源图标库，适合后台管理系统，提供 Figma 插件" },
    { id: "material-symbols", desc: "Google 官方可变矢量图标库，开源免费商用，跨端项目友好" },
    { id: "tabler-icons", desc: "5000+ 干净线性图标，B 端与 SaaS 后台首选，开源免费商用" },
    { id: "iconoir", desc: "圆润柔和开源图标库，年轻化风格，适合消费类 App" },
  ];
  const updateStmt = db.prepare("UPDATE user_links SET description = ? WHERE id = ?");
  for (const u of iconUpdates) {
    updateStmt.run(u.desc, u.id);
  }
}