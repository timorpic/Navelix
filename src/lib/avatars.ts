export interface PresetAvatar {
  id: string;
  name: string;
  url: string;
}

// 系统内置头像库（DiceBear 多风格预设）
export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: "p1",
    name: "青绿人物",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p2",
    name: "深青人物",
    url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nexus&backgroundColor=0d9488",
  },
  {
    id: "p3",
    name: "机器人",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p4",
    name: "机器人绿",
    url: "https://api.dicebear.com/7.x/bottts/svg?seed=Panel&backgroundColor=2dd4bf",
  },
  {
    id: "p5",
    name: "几何标识",
    url: "https://api.dicebear.com/7.x/identicon/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p6",
    name: "插画少女",
    url: "https://api.dicebear.com/7.x/lorelei/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p7",
    name: "像素风",
    url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p8",
    name: "简约人物",
    url: "https://api.dicebear.com/7.x/notionists/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p9",
    name: "冒险家",
    url: "https://api.dicebear.com/7.x/adventurer/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p10",
    name: "笑脸",
    url: "https://api.dicebear.com/7.x/big-smile/svg?seed=Navelix&backgroundColor=14b8a6",
  },
  {
    id: "p11",
    name: "涂鸦人物",
    url: "https://api.dicebear.com/7.x/open-peeps/svg?seed=Navelix&backgroundColor=0d9488",
  },
  {
    id: "p12",
    name: "卡通人",
    url: "https://api.dicebear.com/7.x/croodles/svg?seed=Navelix&backgroundColor=2dd4bf",
  },
];

function defaultAvatar(username?: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
    username || "User",
  )}&backgroundColor=14b8a6`;
}

// 将存储的头像值解析为可显示的图片地址：
// - 空值：按用户名生成默认头像
// - preset:<id>：系统内置头像
// - 其他：视为图片链接 / data URL
export function resolveAvatar(
  avatar: string | undefined,
  username?: string,
): string {
  if (!avatar) return defaultAvatar(username);
  if (avatar.startsWith("preset:")) {
    const id = avatar.slice("preset:".length);
    const found = PRESET_AVATARS.find((p) => p.id === id);
    return found ? found.url : defaultAvatar(username);
  }
  return avatar;
}
