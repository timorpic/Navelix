import { writeLog } from "./logging/events.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { deleteProjectCascade } from "./todos-projects.ts";
import { db } from "./db.ts";
import { emitUserEvent } from "./events.ts";
import { projectStatusLabelZh, toStoredStatus } from "./project-status.ts";

/**
 * AI Copilot 工具调用执行器。
 * AI 在回复中以 <TOOL>{"tool":"create_todo","args":{...}}</TOOL> 形式请求写操作，
 * 服务端解析后在此执行（始终限定当前用户，杜绝越权）。
 */

export interface AiToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export type AiToolResult =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | {
      needsConfirmation: true;
      message: string;
      /** 确认卡与按钮路径使用的不可猜测标识符 */
      pendingId: string;
      /** 将被删除的目标名称，供前端展示确认卡 */
      targetName: string;
    };

/** 已确认执行的删除结果：只可能是成功或失败，不可能是待确认 */
export type AiToolExecResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * 生成实体 ID。
 *
 * 原实现是 `todo-${Date.now()}-${Math.random()...}`：时间戳 + 36 进制随机后缀，
 * 同一毫秒内的并发创建可能碰撞，且 Math.random 不是安全随机源。改用 UUID，
 * 保留既有 `todo-` / `proj-` 前缀（`todos-projects.ts` 存在基于前缀的兼容判断）。
 */
function todoId(): string {
  return `todo-${randomUUID()}`;
}

function projectId(): string {
  return `proj-${randomUUID()}`;
}

function normalizePriority(v: unknown): string {
  return v === "high" || v === "low" ? (v as string) : "medium";
}

function str(v: unknown, fallback = ""): string {
  return v === undefined || v === null ? fallback : String(v).trim();
}

function bool(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

function runCreateTodo(userId: string, args: Record<string, unknown>): AiToolExecResult {
  const title = str(args.title);
  if (!title) return { ok: false, error: "待办标题不能为空" };

  const id = todoId();
  const priority = normalizePriority(args.priority);
  const dueDate = str(args.dueDate).slice(0, 10);
  const projectIdVal = str(args.projectId);

  const maxSort = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) AS m FROM user_todos WHERE user_id = ? AND done = 0",
    )
    .get(userId) as { m: number };

  db.prepare(
    `INSERT INTO user_todos (
      id, user_id, title, priority, done, due_date, project_id, created_at, sort_order
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
  ).run(id, userId, title, priority, dueDate, projectIdVal, Date.now(), maxSort.m + 1);

  emitUserEvent(userId, "todos:change");
  return {
    ok: true,
    message: `已创建待办「${title}」${dueDate ? `，截止 ${dueDate}` : ""}（优先级：${
      priority === "high" ? "高" : priority === "low" ? "低" : "中"
    }）。`,
  };
}

function runUpdateTodo(userId: string, args: Record<string, unknown>): AiToolExecResult {
  const id = str(args.id);
  if (!id) return { ok: false, error: "缺少待办 ID" };

  // 校验存在性且属于当前用户
  const row = db
    .prepare("SELECT id FROM user_todos WHERE id = ? AND user_id = ?")
    .get(id, userId);
  if (!row) return { ok: false, error: `未找到待办「${id}」，或无权修改` };

  const fields: string[] = [];
  const vals: (string | number)[] = [];
  if (args.title !== undefined) {
    const t = str(args.title);
    if (!t) return { ok: false, error: "待办标题不能为空" };
    fields.push("title = ?");
    vals.push(t);
  }
  if (args.priority !== undefined) {
    fields.push("priority = ?");
    vals.push(normalizePriority(args.priority));
  }
  if (args.dueDate !== undefined) {
    fields.push("due_date = ?");
    vals.push(str(args.dueDate).slice(0, 10));
  }
  if (args.done !== undefined) {
    fields.push("done = ?");
    vals.push(bool(args.done) ? 1 : 0);
  }
  if (args.projectId !== undefined) {
    fields.push("project_id = ?");
    vals.push(str(args.projectId));
  }

  if (fields.length > 0) {
    vals.push(id, userId);
    db.prepare(
      `UPDATE user_todos SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    ).run(...vals);
    emitUserEvent(userId, "todos:change");
  }

  return { ok: true, message: "待办已更新。" };
}

function runDeleteTodo(userId: string, args: Record<string, unknown>): AiToolExecResult {
  const id = str(args.id);
  if (!id) return { ok: false, error: "缺少待办 ID" };

  const row = db
    .prepare("SELECT title FROM user_todos WHERE id = ? AND user_id = ?")
    .get(id, userId) as { title: string } | undefined;
  if (!row) return { ok: false, error: `未找到待办「${id}」，或无权删除` };

  db.prepare("DELETE FROM user_todos WHERE id = ? AND user_id = ?").run(id, userId);
  emitUserEvent(userId, "todos:change");
  return { ok: true, message: `已删除待办「${row.title}」。` };
}

function runCreateProject(userId: string, args: Record<string, unknown>): AiToolExecResult {
  const name = str(args.name);
  if (!name) return { ok: false, error: "项目名称不能为空" };

  const id = projectId();
  const status = toStoredStatus(args.status);
  const color = str(args.color, "#00C776");
  const url = str(args.url);
  const description = str(args.description);
  const now = Date.now();

  const maxSort = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM projects WHERE user_id = ?")
    .get(userId) as { m: number };

  db.prepare(
    `INSERT INTO projects (id, user_id, name, description, status, status_color, url, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, name, description, status, color, url, maxSort.m + 1, now, now);

  emitUserEvent(userId, "projects:change");
  return { ok: true, message: `已创建项目「${name}」（状态：${projectStatusLabelZh(status)}）。` };
}

function runUpdateProject(userId: string, args: Record<string, unknown>): AiToolExecResult {
  const id = str(args.id);
  if (!id) return { ok: false, error: "缺少项目 ID" };

  const row = db
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
    .get(id, userId);
  if (!row) return { ok: false, error: `未找到项目「${id}」，或无权修改` };

  const fields: string[] = [];
  const vals: (string | number)[] = [];
  if (args.name !== undefined) {
    const n = str(args.name);
    if (!n) return { ok: false, error: "项目名称不能为空" };
    fields.push("name = ?");
    vals.push(n);
  }
  if (args.status !== undefined) {
    fields.push("status = ?");
    vals.push(toStoredStatus(args.status));
  }
  if (args.color !== undefined) {
    fields.push("status_color = ?");
    vals.push(str(args.color, "#00C776"));
  }
  if (args.url !== undefined) {
    fields.push("url = ?");
    vals.push(str(args.url));
  }
  if (args.description !== undefined) {
    fields.push("description = ?");
    vals.push(str(args.description));
  }
  if (fields.length > 0) {
    fields.push("updated_at = ?");
    vals.push(Date.now());
    vals.push(id, userId);
    db.prepare(
      `UPDATE projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    ).run(...vals);
    emitUserEvent(userId, "projects:change");
  }

  return { ok: true, message: "项目已更新。" };
}

function runDeleteProject(userId: string, args: Record<string, unknown>): AiToolExecResult {
  const id = str(args.id);
  if (!id) return { ok: false, error: "缺少项目 ID" };

  const row = db
    .prepare("SELECT name FROM projects WHERE id = ? AND user_id = ?")
    .get(id, userId) as { name: string } | undefined;
  if (!row) return { ok: false, error: `未找到项目「${id}」，或无权删除` };

  // 清理项目及其子待办
  deleteProjectCascade(id, userId);
  emitUserEvent(userId, "projects:change");
  emitUserEvent(userId, "todos:change");
  return { ok: true, message: `已删除项目「${row.name}」及其关联待办。` };
}

/** 执行单个工具调用（非删除类工具直接执行） */
function executeAiToolInternal(userId: string, call: AiToolCall): AiToolExecResult {
  switch (call.tool) {
    case "create_todo":
      return runCreateTodo(userId, call.args);
    case "update_todo":
      return runUpdateTodo(userId, call.args);
    case "create_project":
      return runCreateProject(userId, call.args);
    case "update_project":
      return runUpdateProject(userId, call.args);
    default:
      return { ok: false, error: `未知工具：${call.tool}` };
  }
}

/**
 * 删除类工具必须二次确认：防止 Prompt Injection 诱导 AI 输出 <TOOL> 造成误删。
 *
 * 流程分两条路径：
 * - 主路径（确定性）：AI 请求删除 → stageDelete 暂存并返回 pendingId →
 *   前端确认卡调用 POST /api/ai/confirm-delete（decision 为枚举）→ 服务端执行。
 * - 兼容路径：用户在聊天框键入「确认删除 xxxxxxxx」或整句取消词，由
 *   consumePendingDelete 消费。
 *
 * 待确认项存放在进程内 Map 中（单容器部署）。多副本部署时需迁到 SQLite 表。
 */
const DESTRUCTIVE_TOOLS = new Set(["delete_todo", "delete_project"]);
const PENDING_TTL_MS = 5 * 60 * 1000;

interface PendingDelete {
  userId: string;
  tool: "delete_todo" | "delete_project";
  args: Record<string, unknown>;
  targetName: string;
  expiresAt: number;
  confirmation: string;
}

/**
 * 键为 `pendingId`（随机 nonce），值为待确认请求。
 *
 * 旧实现以 `(userId, conversationId)` 为键，同一会话里连续两次删除请求
 * 会互相覆盖；改用 nonce 后，确认动作与「发起时的那一次请求」一一对应。
 */
const pendingDeletes = new Map<string, PendingDelete>();
/** 每个用户的当前 pendingId，供文本确认路径定位（不含在键里，避免跨用户命中） */
const pendingByUser = new Map<string, string>();

/** 是否是删除类（需二次确认）工具 */
export function isDestructiveTool(tool: string): boolean {
  return DESTRUCTIVE_TOOLS.has(tool);
}

function resolveDeleteTargetName(userId: string, call: AiToolCall): string | null {
  const id = str(call.args.id);
  if (!id) return null;
  if (call.tool === "delete_todo") {
    const row = db
      .prepare("SELECT title FROM user_todos WHERE id = ? AND user_id = ?")
      .get(id, userId) as { title: string } | undefined;
    return row ? row.title : null;
  }
  if (call.tool === "delete_project") {
    const row = db
      .prepare("SELECT name FROM projects WHERE id = ? AND user_id = ?")
      .get(id, userId) as { name: string } | undefined;
    return row ? row.name : null;
  }
  return null;
}

function runPendingDelete(pending: PendingDelete): AiToolExecResult {
  if (pending.tool === "delete_todo") {
    return runDeleteTodo(pending.userId, pending.args);
  }
  return runDeleteProject(pending.userId, pending.args);
}

/** 清理过期项（含用户索引） */
function pruneExpiredPending(): void {
  const now = Date.now();
  for (const [pendingId, pending] of pendingDeletes) {
    if (pending.expiresAt > now) continue;
    pendingDeletes.delete(pendingId);
    if (pendingByUser.get(pending.userId) === pendingId) pendingByUser.delete(pending.userId);
  }
}

/** 暂存删除请求，返回确认卡数据；不立即执行。 */
export function stageDelete(userId: string, call: AiToolCall): AiToolResult {
  const targetName = resolveDeleteTargetName(userId, call);
  if (targetName === null) {
    return { ok: false, error: `未找到要删除的目标，或无权删除` };
  }
  pruneExpiredPending();
  const pendingId = randomBytes(16).toString("hex");
  const confirmation = `确认删除 ${randomBytes(4).toString("hex")}`;
  pendingDeletes.set(pendingId, {
    userId,
    tool: call.tool as "delete_todo" | "delete_project",
    args: call.args,
    targetName,
    expiresAt: Date.now() + PENDING_TTL_MS,
    confirmation,
  });
  pendingByUser.set(userId, pendingId);
  return {
    needsConfirmation: true,
    pendingId,
    targetName,
    message: `⚠️ 删除操作需要您的确认：将删除「${targetName}」。\n请点击上方按钮确认，或回复「${confirmation}」继续执行；若非本人操作，忽略此消息即可。`,
  };
}

function consumePending(userId: string, pendingId: string): AiToolExecResult {
  const pending = pendingDeletes.get(pendingId);
  // 归属校验：pendingId 泄漏时也不能被其他用户消费
  if (!pending || pending.userId !== userId) return { ok: false, error: "确认请求不存在或已过期，请重新发起删除。" };
  pendingDeletes.delete(pendingId);
  if (pendingByUser.get(userId) === pendingId) pendingByUser.delete(userId);
  if (Date.now() > pending.expiresAt) {
    return { ok: false, error: "确认已过期，请重新发起删除。" };
  }
  const result = runPendingDelete(pending);
  writeLog({ category: "ai", event: "ai.tool.delete.confirmed", actorId: userId, outcome: result.ok ? "succeeded" : "failed" });
  return result;
}

/**
 * 结构化确认（主路径）：`decision` 是枚举，不解析任何自然语言。
 * 返回 null 表示 pendingId 无效/过期/不属于该用户。
 */
export function confirmPendingDelete(
  userId: string,
  pendingId: unknown,
  decision: "confirm" | "cancel",
): AiToolExecResult | null {
  if (typeof pendingId !== "string" || !/^[a-f0-9]{32}$/.test(pendingId)) return null;
  pruneExpiredPending();
  const pending = pendingDeletes.get(pendingId);
  if (!pending || pending.userId !== userId) return null;
  if (decision === "cancel") {
    pendingDeletes.delete(pendingId);
    if (pendingByUser.get(userId) === pendingId) pendingByUser.delete(userId);
    writeLog({ category: "ai", event: "ai.tool.delete.cancelled", outcome: "cancelled", actorId: userId });
    return { ok: true, message: "已取消删除操作。" };
  }
  return consumePending(userId, pendingId);
}

/**
 * 兼容路径：从聊天文本中消费确认。
 *
 * 顺序很重要：先比对精确确认串，再匹配**整句**取消词，其余一律视为未确认
 * 并返回 null（交给正常对话）。旧实现先跑非锚定的取消正则，导致
 * 「别的地方还有任务吗」这类追问会静默撤销待确认删除。
 */
export function consumePendingDelete(
  userId: string,
  userPrompt: string,
  conversationId: string,
): AiToolExecResult | null {
  void conversationId; // 保留参数以兼容既有调用方；定位改由 pendingByUser 完成
  pruneExpiredPending();
  const pendingId = pendingByUser.get(userId);
  if (!pendingId) return null;
  const pending = pendingDeletes.get(pendingId);
  if (!pending) {
    pendingByUser.delete(userId);
    return null;
  }

  const prompt = userPrompt.trim();
  if (prompt === pending.confirmation) return consumePending(userId, pendingId);
  if (/^(取消|不了|不用了|不要了|撤销|算了|cancel|no)[。！!.\s]*$/i.test(prompt)) {
    pendingDeletes.delete(pendingId);
    pendingByUser.delete(userId);
    writeLog({ category: "ai", event: "ai.tool.delete.cancelled", outcome: "cancelled", actorId: userId });
    return { ok: true, message: "已取消删除操作。" };
  }
  return null;
}

/** 从 AI 回复文本中解析 <TOOL>...</TOOL> 工具调用块（可多个） */
export function extractToolCalls(replyText: string): AiToolCall[] {
  const calls: AiToolCall[] = [];
  const regex = /<TOOL>([\s\S]*?)<\/TOOL>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(replyText)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as Partial<AiToolCall>;
      if (parsed && typeof parsed.tool === "string") {
        calls.push({ tool: parsed.tool, args: (parsed.args as Record<string, unknown>) || {} });
      }
    } catch {
      // 忽略无法解析的块
    }
  }
  return calls;
}

/** 从 AI 回复中剥离工具调用块，只保留给用户看的正文 */
export function stripToolCalls(replyText: string): string {
  return replyText.replace(/<TOOL>[\s\S]*?<\/TOOL>/g, "").trim();
}

export function executeAiTool(userId: string, call: AiToolCall): AiToolExecResult {
  const result = executeAiToolInternal(userId, call);
  writeLog({ category: "ai", event: "ai.tool.executed", actorId: userId, outcome: result.ok ? "succeeded" : "failed", level: result.ok ? "info" : "warn" });
  return result;
}
