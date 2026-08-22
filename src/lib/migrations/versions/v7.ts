import type { DatabaseSync } from "node:sqlite";

/**
 * v7：一次性迁移 —— 为所有用户自动补齐「🖼️ 矢量插画库」分类与 8 大经典插画资源链接。
 */
export function migrateV7(db: DatabaseSync): void {
  const userRows = db.prepare("SELECT id FROM users").all() as { id: string }[];
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO user_categories (id, user_id, name, label, icon, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO user_links (id, user_id, title, url, description, icon, category, is_quick_access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const newCategory = { id: "illustrations", name: "矢量插画库", label: "插画", icon: "🖼️", color: "#00C776" };
  const newLinks = [
    { id: "undraw-link", title: "unDraw", url: "https://undraw.co/illustrations", description: "全球 UI 常用扁平矢量插画，在线实时一键换色", icon: "undraw", category: "illustrations", isQuickAccess: 1 },
    { id: "storyset-link", title: "Storyset", url: "https://storyset.com", description: "Freepik 旗下，支持在线编辑图层与制作动效", icon: "storyset", category: "illustrations", isQuickAccess: 1 },
    { id: "humaaans", title: "humaaans", url: "https://www.humaaans.com", description: "Pablo Stanley 打造的人形模块拼装插画库", icon: "humaaans", category: "illustrations", isQuickAccess: 0 },
    { id: "blush", title: "Blush", url: "https://blush.design", description: "全球多画师组件化拼装插画引擎，支持 Figma 插件", icon: "blush", category: "illustrations", isQuickAccess: 0 },
    { id: "ouch", title: "Icons8 Ouch!", url: "https://icons8.com/illustrations", description: "Icons8 出品，涵盖 3D/扁平/黏土/等距多风格插画", icon: "ouch", category: "illustrations", isQuickAccess: 0 },
    { id: "drawkit", title: "DrawKit", url: "https://drawkit.com", description: "矢量插画与 2D/3D 手绘素材资源包", icon: "drawkit", category: "illustrations", isQuickAccess: 0 },
    { id: "opendoodles", title: "Open Doodles", url: "https://www.opendoodles.com", description: "极简手绘涂鸦风插画库，带色彩生成器", icon: "opendoodles", category: "illustrations", isQuickAccess: 0 },
    { id: "isoflat", title: "IsoFlat", url: "https://isoflat.com", description: "2.5D 等距轴测矢量插画，适合科技与架构可视化", icon: "isoflat", category: "illustrations", isQuickAccess: 0 },
  ];

  for (const u of userRows) {
    try {
      insertCat.run(newCategory.id, u.id, newCategory.name, newCategory.label, newCategory.icon, newCategory.color);
      for (const l of newLinks) {
        insertLink.run(l.id, u.id, l.title, l.url, l.description, l.icon, l.category, l.isQuickAccess);
      }
    } catch {
      // Skip orphan users if deleted concurrently
    }
  }
}