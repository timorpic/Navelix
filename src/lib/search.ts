/**
 * 全局搜索的匹配与排序（T0）。
 *
 * 原实现在组件里做 `field.toLowerCase().includes(keyword)` 并 `slice(0, 8)`：
 * - 全角输入（`ＵＩ`）、大小写、`Next.js` 与 `nextjs` 这类分隔符差异都匹配不到；
 * - 结果按数组顺序截断，标题精确命中可能被描述里的偶然命中挤掉；
 * - 中文长词（「服务器部署」）搜不到语序不同但词都存在的标题（「部署服务器」）。
 *
 * 本模块只做纯计算，不依赖 React 或 DOM：
 * - `normalizeSearchText`：NFKC + 大小写折叠 + 空白归一；
 * - `parseSearchQuery`：ASCII 按空白分词，中文长词生成 2-gram 用于近似匹配；
 * - `scoreSearchFields`：标题 > 描述 > 备注等按字段加权，前缀命中加分；
 * - `rankSearchItems`：按分数排序后再截断，而不是先截断再展示。
 */

export interface SearchTerm {
  /** 原始文本，供高亮使用 */
  raw: string;
  /** NFKC + 小写 + 空白归一 */
  normalized: string;
  /** 去掉分隔符的紧凑形式，用于 `Next.js` ↔ `nextjs` */
  compact: string;
  /** 中文长词（≥3 字）的 2-gram；其他情况为空 */
  bigrams: string[];
}

const SEPARATORS = /[\s\-_/.·,，。;；:：!！?？()[\]{}"'“”‘’<>《》|\\]+/g;
const CJK = /[㐀-鿿豈-﫿]/;

/** NFKC 统一全半角，大小写折叠，空白折叠为单个空格。 */
export function normalizeSearchText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** NFKC + 小写 + 去掉空白与常见分隔符，让 `next.js` 与 `nextjs` 等价。 */
export function compactSearchText(text: string): string {
  return normalizeSearchText(text).replace(SEPARATORS, "");
}

function bigramsOf(value: string): string[] {
  const chars = Array.from(value);
  if (chars.length < 3 || !CJK.test(value)) return [];
  const grams: string[] = [];
  for (let index = 0; index < chars.length - 1; index++) grams.push(chars[index] + chars[index + 1]);
  return Array.from(new Set(grams));
}

/** 拆分查询：保留原始词用于高亮，同时给出归一化与紧凑形式。 */
export function parseSearchQuery(query: string): SearchTerm[] {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(raw => {
      const normalized = normalizeSearchText(raw);
      return { raw, normalized, compact: compactSearchText(raw), bigrams: bigramsOf(normalized) };
    })
    .filter(term => term.normalized.length > 0);
}

/**
 * 单个词条对单个文本的匹配结果；不匹配返回 null。
 *
 * - 精确子串命中：前缀 +30、词边界 +15、其它位置 +0；
 * - 中文长词近似：2-gram 覆盖率 ≥ 60% 才命中，分数按覆盖率打折。
 */
function matchTerm(term: SearchTerm, text: string): number | null {
  const haystack = normalizeSearchText(text);
  if (!haystack) return null;
  const compactHaystack = compactSearchText(text);

  let exact = -1;
  if (term.normalized) exact = haystack.indexOf(term.normalized);
  if (exact < 0 && term.compact) {
    const compactIndex = compactHaystack.indexOf(term.compact);
    if (compactIndex >= 0) exact = 0; // 紧凑命中无法映射回原文位置，按中间命中计
  }
  if (exact >= 0) {
    const atWordBoundary = exact === 0 || /[\s\-_/.·,，。;；:：!！?？()[\]{}"'“”‘’<>《》|\\]/.test(haystack[exact - 1] ?? "");
    return 30 + (exact === 0 ? 30 : atWordBoundary ? 15 : 0);
  }

  if (term.bigrams.length > 0) {
    const matched = term.bigrams.filter(gram => haystack.includes(gram) || compactHaystack.includes(gram)).length;
    const coverage = matched / term.bigrams.length;
    // 2 个 2-gram 的短词要求全中，避免单个常见字误命中
    const required = term.bigrams.length <= 2 ? 1 : 0.6;
    if (coverage >= required) return Math.round(40 * coverage);
  }
  return null;
}

export interface SearchField {
  text: string;
  /** 字段权重：标题 100、描述 40、备注 25 … */
  weight: number;
}

/**
 * 多词 AND：每个词都必须命中至少一个字段。
 * 每个词取字段加权后的最高分，再求和；任一字段都没命中则返回 null。
 */
export function scoreSearchFields(terms: SearchTerm[], fields: SearchField[]): number | null {
  if (terms.length === 0) return null;
  let total = 0;
  for (const term of terms) {
    let best: number | null = null;
    for (const field of fields) {
      if (!field.text) continue;
      const match = matchTerm(term, field.text);
      if (match === null) continue;
      const score = match + field.weight;
      if (best === null || score > best) best = score;
    }
    if (best === null) return null;
    total += best;
  }
  return total;
}

export interface RankOptions<T> {
  query: string;
  fields: (item: T) => SearchField[];
  /** 附加分（使用频次、最近使用、更新时间等），不超过字段权重的影响 */
  bonus?: (item: T) => number;
}

/**
 * 过滤 + 排序；同分保持原数组顺序（稳定排序）。
 * 调用方负责截断（`slice(0, MAX)`），保证「取 top N」而不是「前 N 个命中」。
 */
export function rankSearchItems<T>(items: T[], { query, fields, bonus }: RankOptions<T>): T[] {
  const terms = parseSearchQuery(query);
  if (terms.length === 0) return [];
  const scored: { item: T; score: number; order: number }[] = [];
  items.forEach((item, order) => {
    const score = scoreSearchFields(terms, fields(item));
    if (score === null) return;
    scored.push({ item, score: score + (bonus ? Math.max(0, bonus(item)) : 0), order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map(entry => entry.item);
}

/** 高亮用：返回需要标记的词（原始 + 归一化 + 紧凑），去重且长词优先。 */
export function highlightTerms(query: string): string[] {
  const values = new Set<string>();
  for (const term of parseSearchQuery(query)) {
    values.add(term.raw);
    values.add(term.normalized);
    if (term.compact && term.compact !== term.normalized) values.add(term.compact);
  }
  return [...values].filter(Boolean).sort((a, b) => b.length - a.length);
}
