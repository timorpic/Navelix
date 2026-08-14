import type { SiteLink, Category } from "@/types";

export const categories: Category[] = [
  { id: "ai", name: "AI 工具", label: "AI", icon: "🤖", color: "#00C776" },
  { id: "design", name: "UI & 设计图标", label: "UI", icon: "🎨", color: "#00C776" },
  { id: "illustrations", name: "矢量插画库", label: "插画", icon: "🖼️", color: "#00C776" },
  { id: "dev", name: "开发工具", label: "开发", icon: "💻", color: "#00C776" },
];

export const seedQuickAccess: SiteLink[] = [
  { id: "chatgpt", title: "ChatGPT", url: "https://chat.openai.com", description: "chat.openai.com", icon: "chatgpt", category: "ai", isQuickAccess: true },
  { id: "claude", title: "Claude", url: "https://claude.ai", description: "claude.ai", icon: "claude", category: "ai", isQuickAccess: true },
  { id: "github", title: "GitHub", url: "https://github.com", description: "github.com", icon: "github", category: "dev", isQuickAccess: true },
  { id: "figma", title: "Figma", url: "https://figma.com", description: "figma.com", icon: "figma", category: "design", isQuickAccess: true },
  { id: "undraw", title: "unDraw", url: "https://undraw.co/illustrations", description: "全球 UI 常用扁平矢量插画，在线实时一键换色", icon: "undraw", category: "illustrations", isQuickAccess: true },
  { id: "storyset", title: "Storyset", url: "https://storyset.com", description: "Freepik 旗下，支持在线编辑图层与动效", icon: "storyset", category: "illustrations", isQuickAccess: true },
];

export const siteLinks: SiteLink[] = [
  // AI Tools
  { id: "openai", title: "OpenAI", url: "https://platform.openai.com", description: "platform.openai.com", icon: "openai", category: "ai" },
  { id: "midjourney", title: "Midjourney", url: "https://midjourney.com", description: "midjourney.com", icon: "midjourney", category: "ai" },
  { id: "perplexity", title: "Perplexity", url: "https://perplexity.ai", description: "perplexity.ai", icon: "perplexity", category: "ai" },
  { id: "runway", title: "Runway", url: "https://runwayml.com", description: "runwayml.com", icon: "runway", category: "ai" },
  
  // UI & 设计图标资源
  { id: "figma-cat", title: "Figma", url: "https://figma.com", description: "设计协作神器，支持直接导入各类矢量 Icon", icon: "figma", category: "design" },
  { id: "iconpark-cat", title: "IconPark", url: "https://iconpark.bytedance.com/official", description: "字节开源图标库，完全免费商用，线性/面性/双色，可调描边圆角", icon: "iconpark", category: "design" },
  { id: "iconfont", title: "Iconfont", url: "https://www.iconfont.cn", description: "阿里矢量图标库，海量资源、支持改色与团队库（需注意筛选免费商用标签）", icon: "iconfont", category: "design" },
  { id: "qingicon", title: "QingIcon", url: "https://qingicon.com", description: "国产 B 端开源图标库，适合后台管理系统，提供 Figma 插件", icon: "qingicon", category: "design" },
  { id: "material-symbols", title: "Material Symbols", url: "https://fonts.google.com/icons", description: "Google 官方可变矢量图标库，开源免费商用，跨端项目友好", icon: "google", category: "design" },
  { id: "tabler-icons", title: "Tabler Icons", url: "https://tabler.io/icons", description: "5000+ 干净线性图标，B 端与 SaaS 后台首选，开源免费商用", icon: "tabler", category: "design" },
  { id: "iconoir", title: "Iconoir", url: "https://iconoir.com", description: "圆润柔和开源图标库，年轻化风格，适合消费类 App", icon: "iconoir", category: "design" },

  // 矢量插画库素材
  { id: "undraw-link", title: "unDraw", url: "https://undraw.co/illustrations", description: "全球 UI 常用扁平矢量插画，在线实时一键换色", icon: "undraw", category: "illustrations" },
  { id: "storyset-link", title: "Storyset", url: "https://storyset.com", description: "Freepik 旗下，支持在线编辑图层与制作动效", icon: "storyset", category: "illustrations" },
  { id: "humaaans", title: "humaaans", url: "https://www.humaaans.com", description: "Pablo Stanley 打造的人形模块拼装插画库", icon: "humaaans", category: "illustrations" },
  { id: "blush", title: "Blush", url: "https://blush.design", description: "全球多画师组件化拼装插画引擎，支持 Figma 插件", icon: "blush", category: "illustrations" },
  { id: "ouch", title: "Icons8 Ouch!", url: "https://icons8.com/illustrations", description: "Icons8 出品，涵盖 3D/扁平/黏土/等距多风格插画", icon: "ouch", category: "illustrations" },
  { id: "drawkit", title: "DrawKit", url: "https://drawkit.com", description: "矢量插画与 2D/3D 手绘素材资源包", icon: "drawkit", category: "illustrations" },
  { id: "opendoodles", title: "Open Doodles", url: "https://www.opendoodles.com", description: "极简手绘涂鸦风插画库，带色彩生成器", icon: "opendoodles", category: "illustrations" },
  { id: "isoflat", title: "IsoFlat", url: "https://isoflat.com", description: "2.5D 等距轴测矢量插画，适合科技与架构可视化", icon: "isoflat", category: "illustrations" },

  // 开发工具
  { id: "github-cat", title: "GitHub", url: "https://github.com", description: "github.com", icon: "github", category: "dev" },
  { id: "mdn", title: "MDN Web Docs", url: "https://developer.mozilla.org", description: "developer.mozilla.org", icon: "mdn", category: "dev" },
  { id: "stackoverflow", title: "Stack Overflow", url: "https://stackoverflow.com", description: "stackoverflow.com", icon: "stackoverflow", category: "dev" },
  { id: "vercel-cat", title: "Vercel", url: "https://vercel.com", description: "vercel.com", icon: "vercel", category: "dev" },
];
