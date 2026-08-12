import type { SiteLink, Category } from "@/types";

export const categories: Category[] = [
  { id: "ai", name: "AI 工具", label: "AI", icon: "🤖", color: "#00C776" },
  { id: "design", name: "Design", label: "Des", icon: "🎨", color: "#00C776" },
  { id: "dev", name: "开发工具", label: "开发", icon: "💻", color: "#00C776" },
];

export const seedQuickAccess: SiteLink[] = [
  { id: "chatgpt", title: "ChatGPT", url: "https://chat.openai.com", description: "chat.openai.com", icon: "chatgpt", category: "ai", isQuickAccess: true },
  { id: "claude", title: "Claude", url: "https://claude.ai", description: "claude.ai", icon: "claude", category: "ai", isQuickAccess: true },
  { id: "github", title: "GitHub", url: "https://github.com", description: "github.com", icon: "github", category: "dev", isQuickAccess: true },
  { id: "figma", title: "Figma", url: "https://figma.com", description: "figma.com", icon: "figma", category: "design", isQuickAccess: true },
  { id: "vercel", title: "Vercel", url: "https://vercel.com", description: "vercel.com", icon: "vercel", category: "dev", isQuickAccess: true },
];

export const siteLinks: SiteLink[] = [
  // Quick Access & AI Tools
  { id: "openai", title: "OpenAI", url: "https://platform.openai.com", description: "platform.openai.com", icon: "openai", category: "ai" },
  { id: "midjourney", title: "Midjourney", url: "https://midjourney.com", description: "midjourney.com", icon: "midjourney", category: "ai" },
  { id: "perplexity", title: "Perplexity", url: "https://perplexity.ai", description: "perplexity.ai", icon: "perplexity", category: "ai" },
  { id: "runway", title: "Runway", url: "https://runwayml.com", description: "runwayml.com", icon: "runway", category: "ai" },
  
  // Design
  { id: "figma-cat", title: "Figma", url: "https://figma.com", description: "figma.com", icon: "figma", category: "design" },
  { id: "dribbble", title: "Dribbble", url: "https://dribbble.com", description: "dribbble.com", icon: "dribbble", category: "design" },
  { id: "behance", title: "Behance", url: "https://behance.net", description: "behance.net", icon: "behance", category: "design" },
  { id: "iconify", title: "Iconify", url: "https://iconify.design", description: "iconify.design", icon: "iconify", category: "design" },

  // 开发工具
  { id: "github-cat", title: "GitHub", url: "https://github.com", description: "github.com", icon: "github", category: "dev" },
  { id: "mdn", title: "MDN Web Docs", url: "https://developer.mozilla.org", description: "developer.mozilla.org", icon: "mdn", category: "dev" },
  { id: "stackoverflow", title: "Stack Overflow", url: "https://stackoverflow.com", description: "stackoverflow.com", icon: "stackoverflow", category: "dev" },
  { id: "vercel-cat", title: "Vercel", url: "https://vercel.com", description: "vercel.com", icon: "vercel", category: "dev" },
];
