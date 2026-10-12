import type { Category, SiteLink } from "@/types";

/**
 * 「链接管理」Tab（`admin-links-tab.tsx`，原 764 行）的纯逻辑。
 *
 * 从该文件下沉 —— 分组名回退、关键词过滤、分页切片、
 * 免登录分享链接拼接，以及三个确认弹窗的文案组装，原先都内联在组件里、
 * 无法被单测覆盖。本模块不含任何 React 依赖（localStorage 的读取留在组件侧，
 * 这里只接收已解析的数据），React 状态与副作用见 `admin-links-tab.tsx`。
 */

/**
 * 分组 id → 展示名。查不到时回退为 "AI Tools" —— 这是原内联实现的既有回退值
 * （历史默认分组名），保持原样以免改变界面文案。
 */
export function categoryName(categories: Category[], id: string): string {
  return categories.find((c) => c.id === id)?.name ?? "AI Tools";
}

export interface LinkFilterOptions {
  /** 分组 id，"all" 表示不按分组过滤 */
  category: string;
  /** 关键词，空白串表示不过滤 */
  query: string;
}

/**
 * 按分组与关键词过滤链接，匹配范围与大小写处理与原内联实现一致：
 * 标题 / 网址 / 描述 / 笔记（notes 缺失时按空串参与匹配）。
 * 两个条件都不生效时原样返回入参数组（不复制）。
 */
export function filterLinks(
  links: SiteLink[],
  options: LinkFilterOptions,
): SiteLink[] {
  let result = links;
  if (options.category !== "all") {
    result = result.filter((l) => l.category === options.category);
  }
  if (options.query.trim()) {
    const q = options.query.toLowerCase();
    result = result.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        (l.notes || "").toLowerCase().includes(q),
    );
  }
  return result;
}

/**
 * 取第 `page` 页（从 1 开始）的切片。
 * 页码越界时与 `Array.prototype.slice` 一致地返回空数组，不做钳制 —— 与原实现相同。
 */
export function paginateLinks(
  links: SiteLink[],
  page: number,
  pageSize: number,
): SiteLink[] {
  const start = (page - 1) * pageSize;
  return links.slice(start, start + pageSize);
}

/** 总页数，至少为 1（空列表也显示 1 页）。 */
export function totalLinkPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize) || 1;
}

/** 某个分组下的链接数量（删除分组前用于提示影响面）。 */
export function countLinksInCategory(
  links: SiteLink[],
  categoryId: string,
): number {
  return links.filter((l) => l.category === categoryId).length;
}

/**
 * 拼出要写入剪贴板的免登录分享绝对地址。
 * `sharePath`（含签名 token）由 `POST /api/share/token` 下发，客户端只做拼接，
 * 与原实现 `${window.location.origin}${data.sharePath}` 逐字一致。
 */
export function buildShareUrl(origin: string, sharePath: string): string {
  return `${origin}${sharePath}`;
}

/** 删除单个链接的确认文案（标题缺失时与原先一样显示 undefined）。 */
export function buildLinkDeleteMessage(title: string | undefined): string {
  return `确定要删除链接 "${title}" 吗？`;
}

/** 删除分组的确认文案：分组下有链接时追加影响面说明，否则不追加。 */
export function buildCategoryDeleteMessage(
  name: string | undefined,
  linksInCategory: number,
): string {
  const suffix =
    linksInCategory > 0
      ? `该分组下的 ${linksInCategory} 个链接也将一并被移除。`
      : "";
  return `确定要删除分组 "${name}" 吗？${suffix}`;
}

/** 清空全部链接后的提示文案（数量在清空前取好，由调用方传入）。 */
export function buildClearLinksMessage(count: number): string {
  return `已成功清空所有网址书签链接 (${count} 个)`;
}
