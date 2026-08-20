export interface PresetAvatar {
  id: string;
  name: string;
  url: string;
  category: "notion" | "adventurer" | "anime" | "cute" | "robot" | "geometric";
  categoryName: string;
}

export interface AvatarStyleOption {
  id: string;
  name: string;
  styleKey: string;
  provider: "dicebear" | "boring" | "multiavatar";
}

export const AVATAR_STYLE_OPTIONS: AvatarStyleOption[] = [
  { id: "notionists", name: "Notion 极简手绘", styleKey: "notionists", provider: "dicebear" },
  { id: "adventurer", name: "欧美精致插画", styleKey: "adventurer", provider: "dicebear" },
  { id: "lorelei", name: "日系美型动漫", styleKey: "lorelei", provider: "dicebear" },
  { id: "thumbs", name: "3D 治愈萌系", styleKey: "thumbs", provider: "dicebear" },
  { id: "bottts", name: "赛博科技机器人", styleKey: "bottts", provider: "dicebear" },
  { id: "micah", name: "大牌扁平设计", styleKey: "micah", provider: "dicebear" },
  { id: "open-peeps", name: "潮流黑白手绘", styleKey: "open-peeps", provider: "dicebear" },
  { id: "pixel-art", name: "8-bit 复古像素", styleKey: "pixel-art", provider: "dicebear" },
  { id: "boring-beam", name: "极简渐变色块 (Beam)", styleKey: "beam", provider: "boring" },
  { id: "boring-marble", name: "流体大理石 (Marble)", styleKey: "marble", provider: "boring" },
  { id: "multiavatar", name: "多元国际卡通", styleKey: "multiavatar", provider: "multiavatar" },
];

/**
 * 高颜值精选预设头像库 (基于 DiceBear 9.x + BoringAvatars)
 */
export const PRESET_AVATARS: PresetAvatar[] = [
  // ── 1. Notion 极简手绘风 ──
  {
    id: "notion-1",
    name: "极简眼镜",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=Felix&backgroundColor=e2e8f0",
    category: "notion",
    categoryName: "Notion 手绘",
  },
  {
    id: "notion-2",
    name: "优雅长发",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=Aria&backgroundColor=fef08a",
    category: "notion",
    categoryName: "Notion 手绘",
  },
  {
    id: "notion-3",
    name: "短发极客",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=Leo&backgroundColor=bbf7d0",
    category: "notion",
    categoryName: "Notion 手绘",
  },
  {
    id: "notion-4",
    name: "文艺插画",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=Maya&backgroundColor=fbcfe8",
    category: "notion",
    categoryName: "Notion 手绘",
  },
  {
    id: "notion-5",
    name: "商务职场",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=Ethan&backgroundColor=bfdbfe",
    category: "notion",
    categoryName: "Notion 手绘",
  },
  {
    id: "notion-6",
    name: "随性手绘",
    url: "https://api.dicebear.com/9.x/notionists/svg?seed=Chloe&backgroundColor=fed7aa",
    category: "notion",
    categoryName: "Notion 手绘",
  },

  // ── 2. 欧美精致插画 ──
  {
    id: "adv-1",
    name: "探险家",
    url: "https://api.dicebear.com/9.x/adventurer/svg?seed=Mason&backgroundColor=b6e3f4",
    category: "adventurer",
    categoryName: "精致插画",
  },
  {
    id: "adv-2",
    name: "魔法师",
    url: "https://api.dicebear.com/9.x/adventurer/svg?seed=Luna&backgroundColor=ffd5dc",
    category: "adventurer",
    categoryName: "精致插画",
  },
  {
    id: "adv-3",
    name: "游侠",
    url: "https://api.dicebear.com/9.x/adventurer/svg?seed=Jack&backgroundColor=c0aede",
    category: "adventurer",
    categoryName: "精致插画",
  },
  {
    id: "adv-4",
    name: "星际旅人",
    url: "https://api.dicebear.com/9.x/adventurer/svg?seed=Zoe&backgroundColor=d1d4f9",
    category: "adventurer",
    categoryName: "精致插画",
  },
  {
    id: "adv-5",
    name: "学者",
    url: "https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&backgroundColor=ffdfbf",
    category: "adventurer",
    categoryName: "精致插画",
  },
  {
    id: "adv-6",
    name: "吟游诗人",
    url: "https://api.dicebear.com/9.x/adventurer/svg?seed=Emma&backgroundColor=bbf7d0",
    category: "adventurer",
    categoryName: "精致插画",
  },

  // ── 3. 日系美型动漫 ──
  {
    id: "lor-1",
    name: "星野",
    url: "https://api.dicebear.com/9.x/lorelei/svg?seed=Hoshino&backgroundColor=ffd5dc",
    category: "anime",
    categoryName: "二次元美型",
  },
  {
    id: "lor-2",
    name: "苍空",
    url: "https://api.dicebear.com/9.x/lorelei/svg?seed=Sora&backgroundColor=b6e3f4",
    category: "anime",
    categoryName: "二次元美型",
  },
  {
    id: "lor-3",
    name: "秋月",
    url: "https://api.dicebear.com/9.x/lorelei/svg?seed=Aki&backgroundColor=ffdfbf",
    category: "anime",
    categoryName: "二次元美型",
  },
  {
    id: "lor-4",
    name: "紫罗兰",
    url: "https://api.dicebear.com/9.x/lorelei/svg?seed=Violet&backgroundColor=c0aede",
    category: "anime",
    categoryName: "二次元美型",
  },
  {
    id: "lor-5",
    name: "青羽",
    url: "https://api.dicebear.com/9.x/lorelei/svg?seed=Aoba&backgroundColor=bbf7d0",
    category: "anime",
    categoryName: "二次元美型",
  },
  {
    id: "lor-6",
    name: "光希",
    url: "https://api.dicebear.com/9.x/lorelei/svg?seed=Mitsuki&backgroundColor=fed7aa",
    category: "anime",
    categoryName: "二次元美型",
  },

  // ── 4. 3D 治愈萌系 ──
  {
    id: "thumb-1",
    name: "开心微笑",
    url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Joy&backgroundColor=ffd5dc",
    category: "cute",
    categoryName: "3D 萌系",
  },
  {
    id: "thumb-2",
    name: "调皮眨眼",
    url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Wink&backgroundColor=b6e3f4",
    category: "cute",
    categoryName: "3D 萌系",
  },
  {
    id: "thumb-3",
    name: "酷感墨镜",
    url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Cool&backgroundColor=bbf7d0",
    category: "cute",
    categoryName: "3D 萌系",
  },
  {
    id: "thumb-4",
    name: "软萌猫猫",
    url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Kitty&backgroundColor=fef08a",
    category: "cute",
    categoryName: "3D 萌系",
  },
  {
    id: "thumb-5",
    name: "发光小兔",
    url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Bunny&backgroundColor=fbcfe8",
    category: "cute",
    categoryName: "3D 萌系",
  },
  {
    id: "thumb-6",
    name: "元气小熊",
    url: "https://api.dicebear.com/9.x/thumbs/svg?seed=Bear&backgroundColor=fed7aa",
    category: "cute",
    categoryName: "3D 萌系",
  },

  // ── 5. 赛博科技机器人 ──
  {
    id: "bot-1",
    name: "机械先驱",
    url: "https://api.dicebear.com/9.x/bottts/svg?seed=NexusAlpha&backgroundColor=b6e3f4",
    category: "robot",
    categoryName: "科技机器人",
  },
  {
    id: "bot-2",
    name: "赛博幽灵",
    url: "https://api.dicebear.com/9.x/bottts/svg?seed=GhostCyber&backgroundColor=c0aede",
    category: "robot",
    categoryName: "科技机器人",
  },
  {
    id: "bot-3",
    name: "量子核心",
    url: "https://api.dicebear.com/9.x/bottts/svg?seed=Quantum&backgroundColor=2dd4bf",
    category: "robot",
    categoryName: "科技机器人",
  },
  {
    id: "bot-4",
    name: "黑客哨兵",
    url: "https://api.dicebear.com/9.x/bottts/svg?seed=Sentinel&backgroundColor=ffd5dc",
    category: "robot",
    categoryName: "科技机器人",
  },
  {
    id: "bot-5",
    name: "仿生智械",
    url: "https://api.dicebear.com/9.x/bottts/svg?seed=Bionic&backgroundColor=d1d4f9",
    category: "robot",
    categoryName: "科技机器人",
  },
  {
    id: "bot-6",
    name: "霓虹机体",
    url: "https://api.dicebear.com/9.x/bottts/svg?seed=Neon&backgroundColor=ffdfbf",
    category: "robot",
    categoryName: "科技机器人",
  },

  // ── 6. 极简几何与艺术 ──
  {
    id: "geo-1",
    name: "极简光谱",
    url: "https://source.boringavatars.com/beam/120/NavelixSpectrum?colors=00C776,2a9d8f,e9c46a,f4a261,e76f51",
    category: "geometric",
    categoryName: "艺术几何",
  },
  {
    id: "geo-2",
    name: "深空极光",
    url: "https://source.boringavatars.com/beam/120/AuroraSpace?colors=3b82f6,6366f1,8b5cf6,ec4899,10b981",
    category: "geometric",
    categoryName: "艺术几何",
  },
  {
    id: "geo-3",
    name: "莫兰迪大理石",
    url: "https://source.boringavatars.com/marble/120/MorandiArt?colors=9381ff,b8b8ff,f8f7ff,ffeedb,ffd8be",
    category: "geometric",
    categoryName: "艺术几何",
  },
  {
    id: "geo-4",
    name: "包豪斯抽象",
    url: "https://source.boringavatars.com/bauhaus/120/BauhausGeo?colors=264653,2a9d8f,e9c46a,f4a261,e76f51",
    category: "geometric",
    categoryName: "艺术几何",
  },
  {
    id: "geo-5",
    name: "现代色块",
    url: "https://api.dicebear.com/9.x/shapes/svg?seed=ModernGeo&backgroundColor=b6e3f4",
    category: "geometric",
    categoryName: "艺术几何",
  },
  {
    id: "geo-6",
    name: "多彩抽象",
    url: "https://api.dicebear.com/9.x/shapes/svg?seed=AbstractArt&backgroundColor=ffd5dc",
    category: "geometric",
    categoryName: "艺术几何",
  },
];

// 兼容老版本预设 ID 映射
const LEGACY_PRESET_MAP: Record<string, string> = {
  p1: "https://api.dicebear.com/9.x/notionists/svg?seed=Navelix&backgroundColor=bbf7d0",
  p2: "https://api.dicebear.com/9.x/adventurer/svg?seed=Nexus&backgroundColor=b6e3f4",
  p3: "https://api.dicebear.com/9.x/bottts/svg?seed=Navelix&backgroundColor=2dd4bf",
  p4: "https://api.dicebear.com/9.x/bottts/svg?seed=Panel&backgroundColor=b6e3f4",
  p5: "https://source.boringavatars.com/beam/120/Navelix?colors=00C776,2a9d8f,e9c46a",
  p6: "https://api.dicebear.com/9.x/lorelei/svg?seed=Navelix&backgroundColor=ffd5dc",
  p7: "https://api.dicebear.com/9.x/pixel-art/svg?seed=Navelix&backgroundColor=b6e3f4",
  p8: "https://api.dicebear.com/9.x/notionists/svg?seed=Alex&backgroundColor=e2e8f0",
  p9: "https://api.dicebear.com/9.x/adventurer/svg?seed=Oliver&backgroundColor=ffd5dc",
  p10: "https://api.dicebear.com/9.x/thumbs/svg?seed=Joy&backgroundColor=ffd5dc",
  p11: "https://api.dicebear.com/9.x/open-peeps/svg?seed=Navelix&backgroundColor=ffd5dc",
  p12: "https://api.dicebear.com/9.x/micah/svg?seed=Navelix&backgroundColor=b6e3f4",
};

/**
 * 根据用户名和风格生成实时头像 URL
 */
export function buildAvatarUrl(styleId: string, seed: string): string {
  const safeSeed = encodeURIComponent(seed.trim() || "User");
  switch (styleId) {
    case "notionists":
      return `https://api.dicebear.com/9.x/notionists/svg?seed=${safeSeed}&backgroundColor=e2e8f0,bbf7d0,bfdbfe,fef08a,fed7aa,fbcfe8`;
    case "adventurer":
      return `https://api.dicebear.com/9.x/adventurer/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    case "lorelei":
      return `https://api.dicebear.com/9.x/lorelei/svg?seed=${safeSeed}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede,b6e3f4`;
    case "thumbs":
      return `https://api.dicebear.com/9.x/thumbs/svg?seed=${safeSeed}&backgroundColor=ffd5dc,b6e3f4,bbf7d0,fef08a,fbcfe8`;
    case "bottts":
      return `https://api.dicebear.com/9.x/bottts/svg?seed=${safeSeed}&backgroundColor=b6e3f4,2dd4bf,c0aede,ffd5dc`;
    case "micah":
      return `https://api.dicebear.com/9.x/micah/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    case "open-peeps":
      return `https://api.dicebear.com/9.x/open-peeps/svg?seed=${safeSeed}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede,b6e3f4`;
    case "pixel-art":
      return `https://api.dicebear.com/9.x/pixel-art/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
    case "boring-beam":
      return `https://source.boringavatars.com/beam/120/${safeSeed}?colors=00C776,2a9d8f,e9c46a,f4a261,e76f51`;
    case "boring-marble":
      return `https://source.boringavatars.com/marble/120/${safeSeed}?colors=9381ff,b8b8ff,f8f7ff,ffeedb,ffd8be`;
    case "multiavatar":
      return `https://api.multiavatar.com/${safeSeed}.svg`;
    default:
      return `https://api.dicebear.com/9.x/notionists/svg?seed=${safeSeed}&backgroundColor=e2e8f0,bbf7d0,bfdbfe`;
  }
}

/**
 * 默认头像（采用 Notion 极简手绘风）
 */
export function defaultAvatar(username?: string): string {
  const seed = encodeURIComponent(username || "Navelix");
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${seed}&backgroundColor=e2e8f0,bbf7d0,bfdbfe,fef08a`;
}

/**
 * 将存储的头像值解析为可显示的图片地址：
 * - 空值：按用户名生成默认的高颜值 Notionists 头像
 * - preset:<id>：解析系统内置头像
 * - 其他：视为图片链接 / data URL
 */
export function resolveAvatar(
  avatar: string | undefined,
  username?: string,
): string {
  if (!avatar) return defaultAvatar(username);
  if (avatar.startsWith("preset:")) {
    const id = avatar.slice("preset:".length);
    const found = PRESET_AVATARS.find((p) => p.id === id);
    if (found) return found.url;
    if (LEGACY_PRESET_MAP[id]) return LEGACY_PRESET_MAP[id];
    return defaultAvatar(username);
  }
  return avatar;
}
