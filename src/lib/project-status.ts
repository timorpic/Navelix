/**
 * 项目状态的单一真源。
 *
 * 历史问题：`projects.status` 同时被当作「筛选键」「统计键」和「展示文案」。
 * 界面下拉框的 value 直接取翻译后的文本（`text(p.label)`），英文用户保存后
 * 库里会写入 "In progress"；而统计与筛选只认中文包含匹配，于是数据静默失去
 * 归属。本模块把三者拆开：
 *
 * - 存储值与 API 契约：稳定的连字符键（`in-progress` 等），与公开 REST 文档一致；
 * - 展示：规范键经 `PROJECT_STATUS_TRANSLATION_KEYS` 走既有字典；
 * - 未知/自定义值：原样保留，不强行改写用户数据。
 *
 * 读取路径一律经 `normalizeProjectStatus()` 归一化后再判定，因此历史库中的
 * 中文值、英文值以及本次改版前写入的变体都能被正确归类。
 */

export const PROJECT_STATUS_KEYS = [
  "in-progress",
  "research",
  "maintenance",
  "completed",
] as const;

export type ProjectStatusKey = (typeof PROJECT_STATUS_KEYS)[number];

/** 默认状态：新建项目未指定状态时使用。 */
export const DEFAULT_PROJECT_STATUS: ProjectStatusKey = "in-progress";

/** 规范键 → 既有翻译键（`messages/zh-CN.json` / `messages/en.json` 中均已存在）。 */
export const PROJECT_STATUS_TRANSLATION_KEYS: Record<ProjectStatusKey, string> = {
  "in-progress": "in_progress_dc9591e5",
  research: "research_69f307d7",
  maintenance: "maintenance_d7021d9f",
  completed: "completed_f28461bb",
};

/** 服务端无 locale 场景（AI 提示词、日志）使用的中文标签。 */
export const PROJECT_STATUS_LABELS_ZH: Record<ProjectStatusKey, string> = {
  "in-progress": "进行中",
  research: "研究中",
  maintenance: "维护中",
  completed: "已完成",
};

/**
 * 归一化词表。
 *
 * 判定顺序固定为 `completed → maintenance → research → in-progress`：
 * 「已完成开发」必须归入已完成，而不是被「开发」抢先命中为进行中。
 * 精确匹配优先于包含匹配，避免「未开始」之类的短串误伤。
 */
const EXACT: Record<ProjectStatusKey, readonly string[]> = {
  completed: ["completed", "complete", "done", "delivered", "finished", "已完成", "完成", "已上线", "已交付"],
  maintenance: ["maintenance", "maintain", "operations", "ops", "维护中", "维护", "运维"],
  research: ["research", "researching", "exploring", "研究中", "研究", "调研", "探索"],
  "in-progress": [
    "in-progress",
    "in progress",
    "in_progress",
    "progress",
    "active",
    "doing",
    "进行中",
    "进行",
    "开发中",
    "开发",
    // 否定式必须精确命中「进行中」，否则包含匹配会把「未完成」判成已完成
    "未完成",
    "未开始",
    "待开始",
    "not started",
    "not started yet",
    "pending",
    "todo",
    "backlog",
  ],
};

const CONTAINS: Record<ProjectStatusKey, readonly string[]> = {
  completed: ["completed", "finished", "已上线", "已交付", "已完成"],
  maintenance: ["maintenance", "维护", "运维"],
  research: ["research", "研究", "调研"],
  "in-progress": ["progress", "进行", "开发", "active", "doing"],
};

/** 判定顺序：已完成优先，避免复合状态被前面的分类抢走。 */
const MATCH_ORDER: readonly ProjectStatusKey[] = [
  "completed",
  "maintenance",
  "research",
  "in-progress",
];

function normalized(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * 把任意历史值归一化为规范键；无法识别时返回 `null`。
 *
 * 空值按默认状态（进行中）处理 —— 与 `toStoredStatus` 的写入规则一致，
 * 也保留了旧界面「未填状态显示为进行中」的行为。
 *
 * `null` 不代表错误：它表示这是一个用户自定义状态，调用方应保留原值展示，
 * 并在统计中计入 `other`。
 */
export function normalizeProjectStatus(raw: unknown): ProjectStatusKey | null {
  const text = normalized(raw);
  if (!text) return DEFAULT_PROJECT_STATUS;

  for (const key of MATCH_ORDER) {
    if (EXACT[key].includes(text)) return key;
  }
  for (const key of MATCH_ORDER) {
    if (CONTAINS[key].some((token) => text.includes(token))) return key;
  }
  return null;
}

/**
 * 写入存储时使用：可识别的历史/变体值归一化为规范键，空值回退默认状态，
 * 无法识别的**自定义状态原样保留**（不静默改写用户数据）。
 */
export function toStoredStatus(raw: unknown): string {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return DEFAULT_PROJECT_STATUS;
  return normalizeProjectStatus(text) ?? text;
}

/** 是否属于「已完成」语义（供统计与 UI 判定复用）。 */
export function isCompletedStatus(raw: unknown): boolean {
  return normalizeProjectStatus(raw) === "completed";
}

/**
 * 展示用文案：已知状态走字典，自定义状态原样返回。
 *
 * `translate` 由调用方注入（客户端 `useTranslations()`、服务端 `translateText`），
 * 使本模块保持纯函数、可被 Node 测试直接导入。
 */
export function displayProjectStatus(
  raw: unknown,
  translate: (key: string) => string,
): string {
  const key = normalizeProjectStatus(raw);
  if (key) return translate(PROJECT_STATUS_TRANSLATION_KEYS[key]);
  return typeof raw === "string" ? raw.trim() : "";
}

/** 服务端中文标签（AI 提示词与日志）；自定义状态原样返回。 */
export function projectStatusLabelZh(raw: unknown): string {
  const key = normalizeProjectStatus(raw);
  if (key) return PROJECT_STATUS_LABELS_ZH[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * 下拉框的候选项。
 *
 * 若项目当前状态是自定义值（不在四个规范键内），调用方需要把这个值作为
 * 额外选项保留，否则一次「编辑并保存」就会把用户的自定义状态改写掉。
 */
export function projectStatusOptions(raw?: unknown): Array<{ value: string }> {
  const options: Array<{ value: string }> = PROJECT_STATUS_KEYS.map((key) => ({ value: key }));
  const custom = typeof raw === "string" ? raw.trim() : "";
  if (custom && normalizeProjectStatus(custom) === null) {
    options.push({ value: custom });
  }
  return options;
}