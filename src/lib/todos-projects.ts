import { db } from "./db.ts";
import { addDaysLocal } from "./date-utils.ts";

/**
 * 待办与项目的领域写操作（下沉自 api/todos/[id] 与 api/projects/[id] 路由）。
 *
 * 下沉动机：这两个 handler 都包含**多条互相关联的写语句却无事务包裹** ——
 * 中途失败会留下不一致状态。事务边界属于领域不变量，不应由路由掌管
 * （与 `admin-users.ts` 同一思路）。
 */

export interface TodoPatchInput {
  done?: boolean | number;
  title?: unknown;
  priority?: unknown;
  dueDate?: unknown;
  sortOrder?: unknown;
  projectId?: unknown;
  assigneeId?: unknown;
  assigneeName?: unknown;
}

export interface TodoRowForPatch {
  user_id: string;
  assigned_to?: string;
  project_id?: string;
  due_date?: string;
}

/**
 * 更新待办字段，并在关联项目变化时同步两端的 `updated_at`。
 *
 * 修正了一处真实缺陷：原实现只在 `todoRow.project_id`（**旧**项目）非空时
 * 更新那一个项目的 `updated_at`。当用户把待办从一个项目移到另一个项目时，
 * 目标项目的时间戳不会被刷新，而源项目的时间戳却无谓地变了。
 * 现改为同时刷新新旧两个项目。
 *
 * 返回实际写入的字段名列表（空表示无需更新）。
 */
export function updateTodoFields(id: string, input: TodoPatchInput): string[] {
  const fields: string[] = [];
  const vals: (string | number)[] = [];
  const changed: string[] = [];

  if (input.done !== undefined) {
    fields.push("done = ?");
    vals.push(input.done ? 1 : 0);
    changed.push("done");
  }
  if (input.title !== undefined) {
    fields.push("title = ?");
    vals.push(String(input.title).trim());
    changed.push("title");
  }
  if (input.priority !== undefined) {
    fields.push("priority = ?");
    vals.push(String(input.priority));
    changed.push("priority");
  }
  if (input.dueDate !== undefined) {
    fields.push("due_date = ?");
    vals.push(input.dueDate ? String(input.dueDate).slice(0, 10) : "");
    changed.push("dueDate");
  }
  if (input.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    vals.push(Number(input.sortOrder));
    changed.push("sortOrder");
  }
  if (input.projectId !== undefined) {
    fields.push("project_id = ?");
    vals.push(input.projectId ? String(input.projectId).trim() : "");
    changed.push("projectId");
  }
  if (input.assigneeId !== undefined) {
    // assigned_to 是旧列（迁移 v9 前的字段），与 assignee_id 同步写入以兼容历史查询
    fields.push("assignee_id = ?");
    fields.push("assigned_to = ?");
    const aid = input.assigneeId ? String(input.assigneeId).trim() : "";
    vals.push(aid, aid);
    changed.push("assigneeId");
  }
  if (input.assigneeName !== undefined) {
    fields.push("assignee_name = ?");
    vals.push(input.assigneeName ? String(input.assigneeName).trim() : "");
    changed.push("assigneeName");
  }

  if (fields.length === 0) return [];

  vals.push(id);

  db.exec("BEGIN IMMEDIATE;");
  try {
    // 必须在 UPDATE 之前读取：更新后这一列已是新值，就拿不到「源项目」了
    const before = db
      .prepare("SELECT project_id FROM user_todos WHERE id = ?")
      .get(id) as { project_id?: string } | undefined;

    db.prepare(`UPDATE user_todos SET ${fields.join(", ")} WHERE id = ?`).run(...vals);

    // 同步刷新关联项目的 updated_at：待办换项目时，源与目标项目都应感知到变更
    const now = Date.now();
    const touched = new Set<string>();
    if (before?.project_id) touched.add(before.project_id);
    const after = db
      .prepare("SELECT project_id FROM user_todos WHERE id = ?")
      .get(id) as { project_id?: string } | undefined;
    if (after?.project_id) touched.add(after.project_id);
    for (const pid of touched) {
      db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, pid);
    }

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  return changed;
}

/**
 * 删除项目及其子待办（单事务）。
 *
 * 原实现为两条裸 DELETE 逐条提交：若第二条失败，会留下「项目还在但子任务全没了」
 * 的半删状态。
 */
export function deleteProjectCascade(projectId: string, userId: string): void {
  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare("DELETE FROM user_todos WHERE project_id = ? AND user_id = ?").run(
      projectId,
      userId,
    );
    db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(
      projectId,
      userId,
    );
    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }
}

export interface ProjectMilestoneInput {
  id?: string;
  title: string;
  priority?: string;
  dueDate?: string;
  assigneeId?: string;
  assigneeName?: string;
}

/**
 * 同步项目的拆解里程碑任务（增 / 改 / 删），单事务全成或全败。
 *
 * 原实现逐条 update/insert/delete 提交，中途失败会留下部分同步的任务列表 ——
 * 而这条路径正是「AI 拆解后一键保存」的落点，失败代价较高。
 */
export function syncProjectMilestones(
  projectId: string,
  userId: string,
  todos: ProjectMilestoneInput[],
): void {
  db.exec("BEGIN IMMEDIATE;");
  try {
    syncProjectMilestonesInTransaction(projectId, userId, todos);
    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }
}

/**
 * 里程碑同步的**事务内**实现（不自行 BEGIN/COMMIT）。
 *
 * 供 `syncProjectMilestones()`（独占事务）与 `updateProject()`（与项目字段共用
 * 一个事务）两种调用方式复用。
 */
function syncProjectMilestonesInTransaction(
  projectId: string,
  userId: string,
  todos: ProjectMilestoneInput[],
): void {
  const existingTodos = db
    .prepare("SELECT id FROM user_todos WHERE project_id = ? AND user_id = ?")
    .all(projectId, userId) as Array<{ id: string }>;
  const existingIds = new Set(existingTodos.map((t) => t.id));
  const incomingIds = new Set<string>();

  const updateStmt = db.prepare(
      `UPDATE user_todos
       SET title = ?, priority = ?, due_date = ?, assignee_id = ?, assignee_name = ?, sort_order = ?
       WHERE id = ? AND user_id = ?`,
    );

    const insertStmt = db.prepare(
      `INSERT INTO user_todos (
        id, user_id, title, priority, done, due_date, project_id, assignee_id, assignee_name, created_at, sort_order
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    );

    todos.forEach((t, idx) => {
      const tTitle = String(t.title || "").trim();
      // 标题为空的行被跳过，且不进入 incomingIds —— 因此会被下面的清理逻辑删除
      if (!tTitle) return;

      const tPriority =
        t.priority === "high" || t.priority === "low" ? t.priority : "medium";
      const tDueDate = t.dueDate ? String(t.dueDate).slice(0, 10) : "";
      const tAssigneeId = t.assigneeId ? String(t.assigneeId).trim() : "";
      const tAssigneeName = t.assigneeName ? String(t.assigneeName).trim() : "";

      if (t.id && existingIds.has(t.id)) {
        incomingIds.add(t.id);
        updateStmt.run(
          tTitle,
          tPriority,
          tDueDate,
          tAssigneeId,
          tAssigneeName,
          idx,
          t.id,
          userId,
        );
      } else {
        const newId =
          t.id && !t.id.startsWith("temp-")
            ? t.id
            : `todo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        incomingIds.add(newId);
        insertStmt.run(
          newId,
          userId,
          tTitle,
          tPriority,
          tDueDate,
          projectId,
          tAssigneeId,
          tAssigneeName,
          Date.now() + idx,
          idx,
        );
      }
    });

    // 删除已被用户在编辑界面中移除的旧任务
    const deleteStmt = db.prepare(
      "DELETE FROM user_todos WHERE id = ? AND user_id = ?",
    );
    for (const oldId of existingIds) {
      if (!incomingIds.has(oldId)) {
        deleteStmt.run(oldId, userId);
      }
    }

}

export type RolloverMode = "today" | "week";

export interface RolloverResult {
  /** 实际被顺延的待办数量 */
  count: number;
  mode: RolloverMode;
}

/**
 * 一键顺延过期待办，单事务全成或全败。
 *
 * 原实现逐条 UPDATE 提交：顺延到一半失败会留下「一部分已改期、一部分仍是过期」
 * 的状态，用户无法分辨哪些没生效。下沉后包入事务。
 *
 * 两种模式：
 * - `today`：全部顺延到 `todayStr`
 * - `week` ：从今天起均匀平摊到本周剩余天数（今天到周日），按 `sort_order` 轮转
 */
export function rolloverOverdueTodos(
  userId: string,
  todayStr: string,
  mode: RolloverMode,
): RolloverResult {
  const overdueTodos = db
    .prepare(
      "SELECT id, title, due_date FROM user_todos WHERE user_id = ? AND done = 0 AND due_date != '' AND due_date < ? ORDER BY sort_order ASC",
    )
    .all(userId, todayStr) as Array<{ id: string; title: string; due_date: string }>;

  if (overdueTodos.length === 0) {
    return { count: 0, mode };
  }

  db.exec("BEGIN IMMEDIATE;");
  try {
    const updateStmt = db.prepare(
      "UPDATE user_todos SET due_date = ? WHERE id = ? AND user_id = ?",
    );

    if (mode === "today") {
      for (const t of overdueTodos) {
        updateStmt.run(todayStr, t.id, userId);
      }
    } else {
      // 均匀平摊到本周剩余天数（从今天到周日）
      const today = new Date();
      const currentDay = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon, 7=Sun
      const remainingDays = Math.max(1, 7 - currentDay + 1);

      overdueTodos.forEach((t, index) => {
        const offset = index % remainingDays;
        updateStmt.run(addDaysLocal(todayStr, offset), t.id, userId);
      });
    }

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  return { count: overdueTodos.length, mode };
}

export interface CreateTodoInput {
  title: string;
  priority?: unknown;
  dueDate?: unknown;
  projectId?: unknown;
  assigneeId?: unknown;
  assigneeName?: unknown;
}

/**
 * 新建待办（排序值取当前最大 +1），并在关联项目时刷新项目时间戳。
 *
 * 原实现是「查 MAX(sort_order) → INSERT → UPDATE projects」三步裸写，
 * 无事务；中途失败会留下已插入但项目时间戳未更新的状态。下沉后包入事务。
 */
export function createTodo(userId: string, input: CreateTodoInput): string {
  const id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = String(input.title || "").trim();
  const priority =
    input.priority === "high" || input.priority === "low" ? input.priority : "medium";
  const dueDate = input.dueDate ? String(input.dueDate).slice(0, 10) : "";
  const projectId = input.projectId ? String(input.projectId).trim() : "";
  const assigneeId = input.assigneeId ? String(input.assigneeId).trim() : "";
  const assigneeName = input.assigneeName ? String(input.assigneeName).trim() : "";

  db.exec("BEGIN IMMEDIATE;");
  try {
    const maxSort = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM user_todos WHERE user_id = ? AND done = 0",
      )
      .get(userId) as { m: number };

    db.prepare(
      `INSERT INTO user_todos (
        id, user_id, title, priority, done, due_date, project_id, assigned_to, assignee_id, assignee_name, created_at, sort_order
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      title,
      priority,
      dueDate,
      projectId,
      // assigned_to 是迁移前的历史列，与 assignee_id 同步写入以兼容旧查询
      assigneeId,
      assigneeId,
      assigneeName,
      Date.now(),
      maxSort.m + 1,
    );

    if (projectId) {
      db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(Date.now(), projectId);
    }

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  return id;
}

export interface CreateProjectInput {
  name: string;
  description?: unknown;
  status?: unknown;
  color?: unknown;
  /** 兼容旧字段名 */
  statusColor?: unknown;
  url?: unknown;
  /** 可选的拆解里程碑，随项目一并写入 */
  todos?: ProjectMilestoneInput[];
}

export interface CreatedProject {
  id: string;
  name: string;
  status: string;
  color: string;
  statusColor: string;
  url: string;
  sortOrder: number;
}

/**
 * 新建项目，可一并写入拆解出的里程碑（单事务）。
 *
 * 原实现是「查 MAX → INSERT projects → 循环 INSERT todos」多条裸写；
 * 中途失败会留下没有里程碑的项目 —— 而这条路径正是「AI 拆解后一键创建」的落点。
 */
export function createProject(userId: string, input: CreateProjectInput): CreatedProject {
  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const name = String(input.name || "").trim();
  const description = input.description ? String(input.description).trim() : "";
  const status = String(input.status || "进行中").trim();
  const color = String(input.color || input.statusColor || "#00C776").trim();
  const url = input.url ? String(input.url).trim() : "";
  const now = Date.now();

  let sortOrder = 0;

  db.exec("BEGIN IMMEDIATE;");
  try {
    const maxSort = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM projects WHERE user_id = ?")
      .get(userId) as { m: number };
    sortOrder = maxSort.m + 1;

    db.prepare(
      `INSERT INTO projects (id, user_id, name, description, status, status_color, url, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, name, description, status, color, url, sortOrder, now, now);

    if (Array.isArray(input.todos) && input.todos.length > 0) {
      const insertTodo = db.prepare(
        "INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, assignee_id, assignee_name, created_at, sort_order) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
      );
      input.todos.forEach((t, idx) => {
        const tTitle = String(t.title || "").trim();
        if (!tTitle) return; // 标题为空的行跳过（与原实现一致）
        const tId = `todo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        const tPriority =
          t.priority === "high" || t.priority === "low" ? t.priority : "medium";
        insertTodo.run(
          tId,
          userId,
          tTitle,
          tPriority,
          t.dueDate ? String(t.dueDate).slice(0, 10) : "",
          id,
          t.assigneeId ? String(t.assigneeId).trim() : "",
          t.assigneeName ? String(t.assigneeName).trim() : "",
          Date.now() + idx,
          idx,
        );
      });
    }

    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  return {
    id,
    name,
    status,
    color,
    statusColor: color,
    url,
    sortOrder,
  };
}

export interface ProjectPatchInput {
  name?: unknown;
  description?: unknown;
  status?: unknown;
  color?: unknown;
  statusColor?: unknown;
  url?: unknown;
  sortOrder?: unknown;
  /** 传入时一并同步里程碑（增/改/删） */
  todos?: ProjectMilestoneInput[];
}

/**
 * 更新项目字段，可一并同步里程碑 —— **单事务**。
 *
 * 原实现先提交项目字段的 UPDATE，再单独开启一个事务同步里程碑：若里程碑同步
 * 失败，项目名/状态已经改了，而任务列表没跟上，用户看到的是半更新的项目。
 * 两条写路径本就属于同一次「保存项目」操作，应共用一个事务边界。
 *
 * `updated_at` 始终刷新（与原实现一致，即使没有任何字段变化）。
 */
export function updateProject(projectId: string, userId: string, input: ProjectPatchInput): void {
  const fields: string[] = [];
  const vals: (string | number)[] = [];

  if (input.name !== undefined) {
    fields.push("name = ?");
    vals.push(String(input.name).trim());
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    vals.push(String(input.description).trim());
  }
  if (input.status !== undefined) {
    fields.push("status = ?");
    vals.push(String(input.status).trim());
  }
  if (input.color !== undefined || input.statusColor !== undefined) {
    fields.push("status_color = ?");
    vals.push(String(input.color || input.statusColor).trim());
  }
  if (input.url !== undefined) {
    fields.push("url = ?");
    vals.push(String(input.url).trim());
  }
  if (input.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    vals.push(Number(input.sortOrder));
  }

  // 始终更新 updated_at
  fields.push("updated_at = ?");
  vals.push(Date.now());
  vals.push(projectId, userId);

  db.exec("BEGIN IMMEDIATE;");
  try {
    db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(
      ...vals,
    );
    if (Array.isArray(input.todos)) {
      syncProjectMilestonesInTransaction(projectId, userId, input.todos);
    }
    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }
}
