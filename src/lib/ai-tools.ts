import { normalizeProjectStatus, projectStatusLabel } from "./project-status.ts";
import { randomBytes } from "node:crypto";
import { createTodo, createProject, deleteProjectCascade } from "./todos-projects.ts";
import { db } from "./db.ts";
import { emitUserEvent } from "./events.ts";

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
  | { needsConfirmation: true; message: string };

/** 已确认执行的删除结果：只可能是成功或失败，不可能是待确认 */
export type AiToolExecResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

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

  const priority = normalizePriority(args.priority);
  const dueDate = str(args.dueDate).slice(0, 10);
  const projectIdVal = str(args.projectId);

  createTodo(userId, { title, priority, dueDate, projectId: projectIdVal });

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

  const status = normalizeProjectStatus(args.status);
  createProject(userId, { name, status, color: str(args.color, "#00C776"), url: str(args.url), description: str(args.description) });

  emitUserEvent(userId, "projects:change");
  return { ok: true, message: `已创建项目「${name}」（状态：${projectStatusLabel(status)}）。` };
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
    vals.push(normalizeProjectStatus(args.status));
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
export function executeAiTool(userId: string, call: AiToolCall): AiToolExecResult {
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
 * 流程：AI 请求删除 → stageDelete 暂存并提示用户 → 用户回复确认 → consumePendingDelete 真正执行。
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

const pendingDeletes = new Map<string, PendingDelete>();

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

/**
 * 暂存删除请求并提示用户确认（不立即执行）。
 * 返回 needsConfirmation 结果，由前端展示提示，等待用户回复确认。
 */
export function stageDelete(userId: string, call: AiToolCall, conversationId: string): AiToolResult {
  const targetName = resolveDeleteTargetName(userId, call);
  if (targetName === null) {
    return { ok: false, error: `未找到要删除的目标，或无权删除` };
  }
  for (const [key, pending] of pendingDeletes) if (pending.expiresAt <= Date.now()) pendingDeletes.delete(key);
  const confirmation = `确认删除 ${randomBytes(4).toString("hex")}`;
  pendingDeletes.set(JSON.stringify([userId, conversationId]), {
    userId,
    tool: call.tool as "delete_todo" | "delete_project",
    args: call.args,
    targetName,
    expiresAt: Date.now() + PENDING_TTL_MS,
    confirmation,
  });
  return {
    needsConfirmation: true,
    message: `⚠️ 删除操作需要您的确认：将删除「${targetName}」。\n请回复「${confirmation}」继续执行；若非本人操作，忽略此消息即可。`,
  };
}

/**
 * 尝试消费用户的删除确认消息：若存在待确认的删除请求且用户明确确认，则执行并返回结果。
 * 匹配到取消意图或未确认时返回 null，交由正常对话流程处理。
 */
export function consumePendingDelete(
  userId: string,
  userPrompt: string,
  conversationId: string,
): AiToolExecResult | null {
  const key = JSON.stringify([userId, conversationId]);
  const pending = pendingDeletes.get(key);
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    pendingDeletes.delete(key);
    return null;
  }

  const prompt = userPrompt.trim();
  if (/取消|不了|不要|别|撤销|cancel|\bno\b/i.test(prompt)) {
    pendingDeletes.delete(key);
    return { ok: true, message: "已取消删除操作。" };
  }
  if (prompt !== pending.confirmation) return null;
  pendingDeletes.delete(key);
  return runPendingDelete(pending);
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
