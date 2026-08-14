import type { SiteLink, Category } from "@/types";

export const categories: Category[] = [
  { id: "ai", name: "AI 工具", label: "AI", icon: "🤖", color: "#00C776" },
  { id: "design", name: "UI & 设计图标", label: "UI", icon: "🎨", color: "#00C776" },
  { id: "dev", name: "开发工具", label: "开发", icon: "💻", color: "#00C776" },
];

export const seedQuickAccess: SiteLink[] = [
  { id: "chatgpt", title: "ChatGPT", url: "https://chat.openai.com", description: "chat.openai.com", icon: "chatgpt", category: "ai", isQuickAccess: true },
  { id: "claude", title: "Claude", url: "https://claude.ai", description: "claude.ai", icon: "claude", category: "ai", isQuickAccess: true },
  { id: "github", title: "GitHub", url: "https://github.com", description: "github.com", icon: "github", category: "dev", isQuickAccess: true },
  { id: "figma", title: "Figma", url: "https://figma.com", description: "figma.com", icon: "figma", category: "design", isQuickAccess: true },
  { id: "iconpark", title: "IconPark", url: "https://iconpark.bytedance.com/official", description: "字节开源图标库（线性/面性/双色）", icon: "iconpark", category: "design", isQuickAccess: true },
];

export const siteLinks: SiteLink[] = [
  // AI Tools
  { id: "openai", title: "OpenAI", url: "https://platform.openai.com", description: "platform.openai.com", icon: "openai", category: "ai" },
  { id: "midjourney", title: "Midjourney", url: "https://midjourney.com", description: "midjourney.com", icon: "midjourney", category: "ai" },
  { id: "perplexity", title: "Perplexity", url: "https://perplexity.ai", description: "perplexity.ai", icon: "perplexity", category: "ai" },
  { id: "runway", title: "Runway", url: "https://runwayml.com", description: "runwayml.com", icon: "runway", category: "ai" },
  
  // UI & 设计图标资源
  { id: "figma-cat", title: "Figma", url: "https://figma.com", description: "设计协作神器", icon: "figma", category: "design" },
  { id: "iconpark-cat", title: "IconPark", url: "https://iconpark.bytedance.com/official", description: "字节开源图标库，完全免费商用", icon: "iconpark", category: "design" },
  { id: "iconfont", title: "Iconfont", url: "https://www.iconfont.cn", description: "阿里矢量图标库", icon: "iconfont", category: "design" },
  { id: "tabler-icons", title: "Tabler Icons", url: "https://tabler.io/icons", description: "5000+ 线性图标，B端与SaaS首选", icon: "tabler", category: "design" },
  { id: "material-symbols", title: "Material Symbols", url: "https://fonts.google.com/icons", description: "Google 官方可变矢量图标库", icon: "google", category: "design" },
  { id: "iconoir", title: "Iconoir", url: "https://iconoir.com", description: "圆润现代开源图标库", icon: "iconoir", category: "design" },
  { id: "qingicon", title: "QingIcon", url: "https://qingicon.com", description: "国产 B 端开源图标库", icon: "qingicon", category: "design" },

  // 开发工具
  { id: "github-cat", title: "GitHub", url: "https://github.com", description: "github.com", icon: "github", category: "dev" },
  { id: "mdn", title: "MDN Web Docs", url: "https://developer.mozilla.org", description: "developer.mozilla.org", icon: "mdn", category: "dev" },
  { id: "stackoverflow", title: "Stack Overflow", url: "https://stackoverflow.com", description: "stackoverflow.com", icon: "stackoverflow", category: "dev" },
  { id: "vercel-cat", title: "Vercel", url: "https://vercel.com", description: "vercel.com", icon: "vercel", category: "dev" },
];
