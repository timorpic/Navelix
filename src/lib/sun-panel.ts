import type { Category, SiteLink } from "@/types";

export interface SunPanelParseResult {
  categories: Category[];
  links: SiteLink[];
}

interface SunPanelItem {
  url?: string;
  link?: string;
  href?: string;
  targetUrl?: string;
  lanUrl?: string;
  title?: string;
  name?: string;
  text?: string;
  label?: string;
  description?: string;
  remark?: string;
  subTitle?: string;
  info?: string;
  icon?: string | { src?: string; text?: string };
}

interface SunPanelGroup {
  title?: string;
  name?: string;
  groupName?: string;
  categoryName?: string;
  icon?: string;
  children?: SunPanelItem[];
  itemList?: SunPanelItem[];
  items?: SunPanelItem[];
  list?: SunPanelItem[];
  links?: SunPanelItem[];
}

function groupItems(group: SunPanelGroup): SunPanelItem[] {
  return (
    group.children ||
    group.itemList ||
    group.items ||
    group.list ||
    group.links ||
    []
  );
}

function groupTitle(group: SunPanelGroup): string {
  return group.title || group.name || group.groupName || group.categoryName || "常用导航";
}

/**
 * Robust parser for Sun-Panel export JSON files.
 * Supports all versions of Sun-Panel export structures (icons, itemGroupList, groups, categories, raw array).
 */
export function parseSunPanelJSON(jsonStr: string): SunPanelParseResult {
  const categories: Category[] = [];
  const linksArr: SiteLink[] = [];

  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    throw new Error("无效的 JSON 格式文件");
  }

  if (!data) {
    throw new Error("解析内容为空");
  }

  const categoryMap = new Map<string, string>(); // category title -> category id

  const getOrCreateCategoryId = (name: string, icon?: string): string => {
    const trimmed = name.trim() || "Sun-Panel 导入";
    if (categoryMap.has(trimmed)) {
      return categoryMap.get(trimmed)!;
    }
    const id = `sp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    categoryMap.set(trimmed, id);

    let defaultCatIcon = "📌";
    if (trimmed.includes("应用")) defaultCatIcon = "⚡";
    else if (trimmed.includes("影音") || trimmed.includes("娱乐")) defaultCatIcon = "🎬";
    else if (trimmed.includes("Net") || trimmed.includes("网络") || trimmed.includes("Homenet")) defaultCatIcon = "🌐";

    categories.push({
      id,
      name: trimmed,
      label: trimmed.slice(0, 3),
      icon: icon || defaultCatIcon,
      color: "#00C776",
    });
    return id;
  };

  const processItem = (item: SunPanelItem | undefined, catId: string) => {
    if (!item) return;
    const url = item.url || item.link || item.href || item.targetUrl || item.lanUrl;
    if (!url || typeof url !== "string") return;

    const title = item.title || item.name || item.text || item.label || "未命名链接";
    const description = item.description || item.remark || item.subTitle || item.info || "";

    // Extract icon src if present, else empty string so BrandIcon auto-detects favicon
    let icon = "";
    if (item.icon) {
      if (typeof item.icon === "string") {
        icon = item.icon;
      } else {
        icon = item.icon.src || item.icon.text || "";
      }
    }

    linksArr.push({
      id: `splink-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      url,
      description,
      category: catId,
      icon,
    });
  };

  const processGroup = (group: SunPanelGroup) => {
    const catId = getOrCreateCategoryId(groupTitle(group), group.icon);
    groupItems(group).forEach((item) => processItem(item, catId));
  };

  // Case 1: Sun-Panel v1.8.x `icons` top-level group array format
  // { icons: [ { title: "常用应用", children: [ ... ] }, ... ] }
  if (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as Record<string, unknown>).icons)
  ) {
    ((data as Record<string, unknown>).icons as SunPanelGroup[]).forEach(
      processGroup,
    );
  }
  // Case 2: Sun-Panel standard itemGroupList format
  // { itemGroupList: [ { title: "Group", itemList: [ ... ] } ] }
  else if (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as Record<string, unknown>).itemGroupList)
  ) {
    ((data as Record<string, unknown>).itemGroupList as SunPanelGroup[]).forEach(
      processGroup,
    );
  }
  // Case 3: Sun-Panel groups or categories array format
  // { groups: [ ... ] } or { categories: [ ... ] }
  else if (
    typeof data === "object" &&
    data !== null &&
    (Array.isArray((data as Record<string, unknown>).groups) ||
      Array.isArray((data as Record<string, unknown>).categories))
  ) {
    const groups = (data as Record<string, unknown>).groups ||
      (data as Record<string, unknown>).categories;
    (groups as SunPanelGroup[]).forEach(processGroup);
  }
  // Case 4: Root array format
  // [ { title: "Group 1", children/items: [...] } ] OR [ { title: "Link 1", url: "..." } ]
  else if (Array.isArray(data)) {
    (data as unknown[]).forEach((entry) => {
      if (typeof entry !== "object" || entry === null) return;
      const group = entry as SunPanelGroup;
      if (groupItems(group).length > 0) {
        processGroup(group);
      } else {
        // Direct list of links
        const catId = getOrCreateCategoryId("Sun-Panel 导入");
        processItem(entry as SunPanelItem, catId);
      }
    });
  }
  // Case 5: Flat items array inside root object
  // { items: [ ... ] }
  else if (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as Record<string, unknown>).items)
  ) {
    const catId = getOrCreateCategoryId("Sun-Panel 导入");
    ((data as Record<string, unknown>).items as SunPanelItem[]).forEach((item) =>
      processItem(item, catId),
    );
  } else {
    throw new Error("未匹配到合法的 Sun-Panel 数据格式");
  }

  if (linksArr.length === 0) {
    throw new Error("Sun-Panel JSON 文件中未包含有效的网址链接");
  }

  return { categories, links: linksArr };
}
