import { normalizeProjectStatus } from "./project-status.ts";
import { resolveTodoAssignee } from "./workspace-members.ts";
import { db, type PublicUser, type UserRow } from "./db.ts";
import { getWorkspaceRevision } from "./workspace-revision.ts";
import { getUserTodos } from "./todo-store.ts";
import { toPublicUser } from "./auth/session.ts";
import type { Category, Project, SiteLink, SystemConfig, TodoItem } from "@/types";
import { validateConfigPatch } from "./config-validation.ts";
import { encryptSecret } from "./secret.ts";
import { applyEEGateToConfig } from "./ee-gate.ts";
import {
  USER_CONFIG_MAPPED_COLUMNS,
  isGlobalScoped,
  coerceUserConfigValues,
  defaultUserConfig,
  mapUserConfigRow,
} from "./user-config-columns.ts";
import {
  diffConfigChanges,
  getGlobalConfigRow,
  getUserConfigRow,
  recordConfigAuditLog,
  saveGlobalConfig,
  splitConfigByScope,
} from "./global-config.ts";

export interface UserDataResult {
  revision?: string;
  user?: PublicUser | null;
  categories: Category[];
  links: SiteLink[];
  projects: Project[];
  todos: TodoItem[];
  config: SystemConfig;
}

/**
 * 服务端获取用户的完整数据（分类、链接、项目、配置、用户信息）。
 * 用于 SSR 预取：在 Layout 中调用，数据通过 props 传给客户端 Provider。
 * 直接实时查询 SQLite（<0.2ms），确保新增、编辑、删除链接后刷新页面 100% 实时生效。
 * 注：SQLite WAL 模式实时读写，commit 后即可读到，无需主动缓存失效。
 */
export function getUserData(userId: string): UserDataResult {
  // Fetch current user details
  const userRow = db
    .prepare("SELECT id, username, display_name, email, bio, role, avatar FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;

  // 复用 auth/session.ts 的映射，避免与此前手工重写的版本漂移
  const user: PublicUser | null = userRow ? toPublicUser(userRow) : null;

  // Fetch categories (own + subscribed team shared categories)
  const ownCategoryRows = db
    .prepare("SELECT id, name, label, icon, color, is_team_shared FROM user_categories WHERE user_id = ?")
    .all(userId) as Array<{
    id: string;
    name: string;
    label: string;
    icon: string;
    color: string;
    is_team_shared: number;
  }>;

  const ownCategories: Category[] = ownCategoryRows.map((c) => ({
    id: c.id,
    name: c.name,
    label: c.label,
    icon: c.icon,
    color: c.color,
    isTeamShared: c.is_team_shared === 1,
  }));

  const subCategoryRows = db
    .prepare(`
      SELECT c.id, c.name, c.label, c.icon, c.color, c.user_id as owner_id,
             u.display_name as owner_display_name, u.username as owner_username
      FROM user_category_subscriptions s
      JOIN user_categories c ON c.id = s.category_id AND c.user_id = s.owner_id
      JOIN users u ON u.id = s.owner_id
      WHERE s.user_id = ? AND c.is_team_shared = 1
    `)
    .all(userId) as Array<{
    id: string;
    name: string;
    label: string;
    icon: string;
    color: string;
    owner_id: string;
    owner_display_name: string | null;
    owner_username: string;
  }>;

  const sharedId = (owner: string, id: string) => `shared:${encodeURIComponent(owner)}:${encodeURIComponent(id)}`;
  const subCategories: Category[] = subCategoryRows.map((c) => ({
    id: sharedId(c.owner_id, c.id),
    sourceId: c.id,
    name: c.name,
    label: c.label,
    icon: c.icon,
    color: c.color,
    isTeamShared: true,
    isSubscribed: true,
    ownerId: c.owner_id,
    ownerName: c.owner_display_name || c.owner_username,
  }));

  const categoryRows = [...ownCategories, ...subCategories];

  // Fetch links (own + subscribed categories)
  const ownLinkRows = db
    .prepare(
      "SELECT id, title, url, description, icon, category, notes, is_quick_access FROM user_links WHERE user_id = ?",
    )
    .all(userId) as Array<{
    id: string;
    title: string;
    url: string;
    description: string;
    icon: string;
    category: string;
    notes: string;
    is_quick_access: number;
  }>;

  const subLinkRows: Array<(typeof ownLinkRows)[number] & { ownerId: string; sourceId: string; isSubscribed: true }> = [];
  if (subCategoryRows.length > 0) {
    for (const sub of subCategoryRows) {
      const linksInSub = db
        .prepare(
          "SELECT id, title, url, description, icon, category, notes, is_quick_access FROM user_links WHERE user_id = ? AND category = ?",
        )
        .all(sub.owner_id, sub.id) as typeof ownLinkRows;
      subLinkRows.push(...linksInSub.map(link => ({ ...link, id: sharedId(sub.owner_id, link.id),
        category: sharedId(sub.owner_id, sub.id), ownerId: sub.owner_id, sourceId: link.id, isSubscribed: true as const })));
    }
  }

  const linkRows = [...ownLinkRows, ...subLinkRows];

  const links: SiteLink[] = linkRows.map((l) => ({
    ...("ownerId" in l ? { ownerId: String(l.ownerId), isSubscribed: true, sourceId: String("sourceId" in l ? l.sourceId : l.id) } : {}),
    id: l.id,
    title: l.title,
    url: l.url,
    description: l.description,
    icon: l.icon,
    category: l.category,
    notes: l.notes || undefined,
    isQuickAccess: l.is_quick_access === 1,
  }));

  // Fetch projects
  const projectRows = db
    .prepare(
      `SELECT id, name, description, status, status_color, url, sort_order, created_at, updated_at
       FROM projects
       WHERE user_id = ?
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    description: string | null;
    status: string | null;
    status_color: string | null;
    url: string | null;
    sort_order: number;
    created_at: number | null;
    updated_at: number | null;
  }>;

  const projects: Project[] = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    status: normalizeProjectStatus(p.status),
    color: p.status_color || "#00C776",
    statusColor: p.status_color || "#00C776",
    url: p.url || "",
    sortOrder: p.sort_order,
    createdAt: p.created_at ?? undefined,
    updatedAt: p.updated_at ?? undefined,
  }));

  const todos = getUserTodos(userId);

  // 系统配置与当前用户偏好分别读取；历史个人行中的系统列不得覆盖系统设置。
  const globalMapped = splitConfigByScope(mapUserConfigRow(getGlobalConfigRow())).global;
  const personalMapped = splitConfigByScope(mapUserConfigRow(getUserConfigRow(userId))).personal;
  const config = { ...defaultUserConfig(), ...personalMapped, ...globalMapped } as SystemConfig;

  // EE 门禁：无 Pro 授权时强制降级品牌定制 / 代码注入 / 探针开关。
  // 这是 SSR 与 API 两条读取路径的统一收口（见 ee-gate.ts）。
  applyEEGateToConfig(config);

  const result: UserDataResult = { revision: getWorkspaceRevision(userId), user, categories: categoryRows as Category[], links, projects, todos, config };
  // SQLite 返回的行对象原型非标准（null 原型），
  // Next.js 要求传给客户端组件的数据必须是纯对象，深拷贝处理。
  return JSON.parse(JSON.stringify(result)) as UserDataResult;
}

// ── 实体保存（服务端 POST /api/user/data 调用，含 upsert 与 diff 删除语义）──

/** 分类输入（宽松类型，运行期校验并安全转换） */
interface CategoryInput {
  id?: unknown;
  name?: unknown;
  label?: unknown;
  icon?: unknown;
  color?: unknown;
  isTeamShared?: unknown;
  isSubscribed?: unknown;
}

/** 链接输入 */
interface LinkInput {
  ownerId?: unknown;
  isSubscribed?: unknown;
  id?: unknown;
  title?: unknown;
  url?: unknown;
  description?: unknown;
  icon?: unknown;
  category?: unknown;
  isQuickAccess?: unknown;
  notes?: unknown;
}

/** 项目输入 */
interface ProjectInput {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  statusColor?: unknown;
  color?: unknown;
  url?: unknown;
  sortOrder?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** 待办输入 */
interface TodoInput {
  id?: unknown;
  title?: unknown;
  priority?: unknown;
  done?: unknown;
  dueDate?: unknown;
  projectId?: unknown;
  assigneeId?: unknown;
  assigneeName?: unknown;
  assignedTo?: unknown;
  createdAt?: unknown;
  sortOrder?: unknown;
}

/** 保存分类：upsert 传入项，删除不在列表中的旧分类 */
export function saveUserCategories(userId: string, items: CategoryInput[]): void {
  const ownItems = items.filter((c) => c && typeof c === "object" && !c.isSubscribed);
  const incomingIds: string[] = [];
  const upsert = db.prepare(`
    INSERT INTO user_categories (id, user_id, name, label, icon, color, is_team_shared)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET
      name = excluded.name,
      label = excluded.label,
      icon = excluded.icon,
      color = excluded.color,
      is_team_shared = excluded.is_team_shared
  `);
  for (const c of ownItems) {
    if (!c || typeof c !== "object") continue;
    const catId = String(c.id || crypto.randomUUID());
    incomingIds.push(catId);
    const isTeamShared =
      c.isTeamShared === true || c.isTeamShared === 1 || c.isTeamShared === "1" ? 1 : 0;
    upsert.run(
      catId,
      userId,
      String(c.name || ""),
      String(c.label || c.name || ""),
      String(c.icon || "📂"),
      String(c.color || "#00C776"),
      isTeamShared,
    );
  }
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM user_categories WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(userId);
  }
}

/** 保存链接：upsert 传入项，删除不在列表中的旧链接 */
export function saveUserLinks(userId: string, items: LinkInput[]): void {
  const incomingIds: string[] = [];
  const upsert = db.prepare(`
    INSERT INTO user_links (id, user_id, title, url, description, icon, category, notes, is_quick_access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET
      title = excluded.title,
      url = excluded.url,
      description = excluded.description,
      icon = excluded.icon,
      category = excluded.category,
      notes = excluded.notes,
      is_quick_access = excluded.is_quick_access
  `);
  for (const l of items) {
    if (!l || typeof l !== "object" || l.isSubscribed || (l.ownerId && l.ownerId !== userId)) continue;
    const linkId = String(l.id || crypto.randomUUID());
    incomingIds.push(linkId);
    upsert.run(
      linkId,
      userId,
      String(l.title || "未命名链接"),
      String(l.url || "https://example.com"),
      String(l.description || ""),
      String(l.icon || ""),
      String(l.category || "uncategorized"),
      String(l.notes || ""),
      l.isQuickAccess ? 1 : 0,
    );
  }
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM user_links WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM user_links WHERE user_id = ?").run(userId);
  }
}

/** 保存项目：upsert 传入项，删除不在列表中的旧项目 */
export function saveUserProjects(userId: string, items: ProjectInput[]): void {
  const incomingIds: string[] = [];
  const now = Date.now();
  const upsert = db.prepare(`
    INSERT INTO projects (id, user_id, name, description, status, status_color, url, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      status_color = excluded.status_color,
      url = excluded.url,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);
  items.forEach((p, index) => {
    if (!p || typeof p !== "object") return;
    const projId = String(p.id || `proj-${Date.now()}-${index}`);
    incomingIds.push(projId);
    upsert.run(
      projId,
      userId,
      String(p.name || "未命名项目"),
      String(p.description || ""),
      normalizeProjectStatus(p.status),
      String(p.statusColor || p.color || "#00C776"),
      String(p.url || ""),
      typeof p.sortOrder === "number" ? p.sortOrder : index,
      typeof p.createdAt === "number" ? p.createdAt : now,
      typeof p.updatedAt === "number" ? p.updatedAt : now,
    );
  });
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM projects WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM projects WHERE user_id = ?").run(userId);
  }
}

/** 保存待办：upsert 传入项，删除不在列表中的旧待办 */
export function saveUserTodos(userId: string, items: TodoInput[]): void {
  const ownItems = items.filter((t) => t && typeof t === "object" && !(t as { isDelegated?: boolean }).isDelegated);
  const incomingIds: string[] = [];
  const now = Date.now();
  const upsert = db.prepare(`
    INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, assigned_to, assignee_id, assignee_name, created_at, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET
      title = excluded.title,
      priority = excluded.priority,
      done = excluded.done,
      due_date = excluded.due_date,
      project_id = excluded.project_id,
      assigned_to = excluded.assigned_to,
      assignee_id = excluded.assignee_id,
      assignee_name = excluded.assignee_name,
      sort_order = excluded.sort_order
  `);
  ownItems.forEach((t, index) => {
    if (!t || typeof t !== "object") return;
    const todoId = String(t.id || `todo-${Date.now()}-${index}`);
    incomingIds.push(todoId);
    const assignee = resolveTodoAssignee(userId, todoId, t.assigneeId !== undefined ? t.assigneeId : t.assignedTo);
    const assignedTo = assignee.id;
    const assigneeName = assignee.name;
    upsert.run(
      todoId,
      userId,
      String(t.title || "未命名日程"),
      String(t.priority || "medium"),
      t.done ? 1 : 0,
      String(t.dueDate || ""),
      String(t.projectId || ""),
      assignedTo,
      assignedTo,
      assigneeName,
      typeof t.createdAt === "number" ? t.createdAt : now,
      typeof t.sortOrder === "number" ? t.sortOrder : index,
    );
  });
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM user_todos WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM user_todos WHERE user_id = ?").run(userId);
  }
}

/** 配置输入（宽松对象，运行期逐字段校验；密钥字段留空 = 保持不变） */
export type ConfigInput = Record<string, unknown>;

/**
 * 保存配置：按 scope 拆分写入。
 * - 全站级字段（品牌/AI/天气/社交/安全/探针/页脚）→ 写 system_settings；
 * - 个人偏好字段（theme/壁纸/侧边栏/小组件开关等）→ 写当前用户自己的行。
 * 仅更新传入字段，未传字段沿用当前库内值；密钥留空不覆盖。
 * 列定义 / 类型转换 / upsert SQL 全部由 user-config-columns.ts 元数据驱动。
 * 全站字段的真实变更会落审计日志（见 lib/global-config.ts；不再广播站内通知）。
 */
export function saveUserConfigs(
  userId: string,
  cfg: ConfigInput,
): void {
  validateConfigPatch(cfg);
  const { global: globalCfg, personal: personalCfg } = splitConfigByScope(cfg);
  const globalFields = Object.keys(globalCfg).filter(key => key !== "aiKeyConfigured" && key !== "weatherKeyConfigured");
  if (globalFields.length && !db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'admin'").get(userId)) {
    throw new Error("仅管理员可修改系统配置");
  }
  db.exec("SAVEPOINT user_config_save");
  try {
    // 安全告警：自定义脚本/CSS 会绕过 CSP 直接注入到所有访客页面。
    // 此处仅记录日志供运维审计；写入权限已由 POST /api/user/data 的 admin 角色门禁收口。
    if (typeof globalCfg.customHeadScripts === "string" && globalCfg.customHeadScripts.trim() !== "") {
      console.warn(
        "[Security] system_settings.custom_head_scripts 已写入非空内容，将以 dangerouslySetInnerHTML 注入页面（绕过 CSP），请确保来源可信且仅管理员可配置。",
      );
    }
    if (typeof globalCfg.customCss === "string" && globalCfg.customCss.trim() !== "") {
      console.warn(
        "[Security] system_settings.custom_css 已写入非空内容，将以 <style> 注入页面（绕过 CSP style-src），请确保来源可信且仅管理员可配置。",
      );
    }

    // ── 个人偏好：写当前用户自己的行（upsert）──
    if (Object.keys(personalCfg).length > 0) {
      const userCurrentRow = getUserConfigRow(userId);
      const personalValues = coerceUserConfigValues(
        personalCfg,
        userCurrentRow,
        true,
        encryptSecret,
      );
      const columns = USER_CONFIG_MAPPED_COLUMNS.filter(col => !isGlobalScoped(col));
      const names = columns.map(col => col.column);
      const values = USER_CONFIG_MAPPED_COLUMNS.flatMap((col, index) => isGlobalScoped(col) ? [] : [personalValues[index]]);
      const sql = `INSERT INTO user_configs (user_id, ${names.join(", ")}) VALUES (?, ${names.map(() => "?").join(", ")})
        ON CONFLICT(user_id) DO UPDATE SET ${names.map(name => `${name} = excluded.${name}`).join(", ")}`;
      db.prepare(sql).run(userId, ...values);
      recordConfigAuditLog(userId, diffConfigChanges(userCurrentRow, personalCfg), "user_configs");
    }

    // 系统字段独立存储，审计日志不包含密钥明文。
    if (Object.keys(globalCfg).length > 0) {
      const current = getGlobalConfigRow();
      saveGlobalConfig(globalCfg);
      recordConfigAuditLog(userId, diffConfigChanges(current, globalCfg));
    }
    db.exec("RELEASE user_config_save");
  } catch (error) {
    db.exec("ROLLBACK TO user_config_save; RELEASE user_config_save");
    throw error;
  }
}
