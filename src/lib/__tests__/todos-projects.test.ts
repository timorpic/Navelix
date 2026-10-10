import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  createProject,
  createTodo,
  deleteProjectCascade,
  rolloverOverdueTodos,
  syncProjectMilestones,
  updateProject,
  updateTodoFields,
} from "../todos-projects.ts";

/**
 * 待办/项目写操作的事务化单测。
 *
 * 这几个函数此前是路由内的裸写语句（`api/todos/[id]`、`api/projects/[id]`），
 * 无事务包裹且无法测试。下沉到 lib 后在此固定行为，重点覆盖：
 * 字段过滤、`updated_at` 同步（含换项目这一原实现漏掉的分支）、级联删除。
 */

let seq = 0;
function seedUser(): string {
  const uid = `tp-test-${Date.now()}-${seq++}`;
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
     VALUES (?, ?, 'hash', 'TP User', 'user', ?)`,
  ).run(uid, uid, Date.now());
  return uid;
}

function seedProject(userId: string, name = "P"): string {
  const pid = `proj-${Date.now()}-${seq++}`;
  db.prepare(
    `INSERT INTO projects (id, user_id, name, status, status_color, url, sort_order, updated_at)
     VALUES (?, ?, ?, '进行中', '#00C776', '', 0, 0)`,
  ).run(pid, userId, name);
  return pid;
}

function seedTodo(userId: string, projectId = ""): string {
  const tid = `todo-${Date.now()}-${seq++}`;
  db.prepare(
    `INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, created_at, sort_order)
     VALUES (?, ?, 'T', 'medium', 0, '', ?, ?, 0)`,
  ).run(tid, userId, projectId, Date.now());
  return tid;
}

function projectUpdatedAt(pid: string): number {
  const row = db
    .prepare("SELECT updated_at FROM projects WHERE id = ?")
    .get(pid) as { updated_at: number } | undefined;
  return row?.updated_at ?? -1;
}

describe("updateTodoFields", () => {
  it("无字段时返回空数组且不写库", () => {
    const uid = seedUser();
    const tid = seedTodo(uid);
    assert.deepEqual(updateTodoFields(tid, {}), []);
    const row = db.prepare("SELECT title FROM user_todos WHERE id = ?").get(tid) as {
      title: string;
    };
    assert.equal(row.title, "T");
  });

  it("返回实际写入的字段名列表", () => {
    const uid = seedUser();
    const tid = seedTodo(uid);
    assert.deepEqual(
      updateTodoFields(tid, { done: true, title: "  新标题  ", dueDate: "2026-10-12T09:00:00Z" }),
      ["done", "title", "dueDate"],
    );
    const row = db
      .prepare("SELECT done, title, due_date FROM user_todos WHERE id = ?")
      .get(tid) as { done: number; title: string; due_date: string };
    assert.equal(row.done, 1);
    assert.equal(row.title, "新标题", "标题应 trim");
    assert.equal(row.due_date, "2026-10-12", "日期应截断到 YYYY-MM-DD");
  });

  it("assigneeId 同时写入 assignee_id 与历史列 assigned_to", () => {
    const uid = seedUser();
    const tid = seedTodo(uid);
    updateTodoFields(tid, { assigneeId: "u-9" });
    const row = db
      .prepare("SELECT assignee_id, assigned_to FROM user_todos WHERE id = ?")
      .get(tid) as { assignee_id: string; assigned_to: string };
    assert.equal(row.assignee_id, "u-9");
    assert.equal(row.assigned_to, "u-9");
  });

  it("清空 assigneeId 时两列一起清空", () => {
    const uid = seedUser();
    const tid = seedTodo(uid);
    updateTodoFields(tid, { assigneeId: "u-9" });
    updateTodoFields(tid, { assigneeId: "" });
    const row = db
      .prepare("SELECT assignee_id, assigned_to FROM user_todos WHERE id = ?")
      .get(tid) as { assignee_id: string; assigned_to: string };
    assert.equal(row.assignee_id, "");
    assert.equal(row.assigned_to, "");
  });

  it("关联项目未变时只刷新该项目的时间戳", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    const tid = seedTodo(uid, pid);
    updateTodoFields(tid, { title: "x" });
    assert.ok(projectUpdatedAt(pid) > 0, "同项目内的编辑也应刷新项目时间戳");
  });

  it("换项目时源项目与目标项目的时间戳都刷新（原实现只刷新源项目）", () => {
    const uid = seedUser();
    const from = seedProject(uid, "源");
    const to = seedProject(uid, "目标");
    const tid = seedTodo(uid, from);

    updateTodoFields(tid, { projectId: to });

    assert.ok(projectUpdatedAt(from) > 0, "源项目应感知到待办被移走");
    assert.ok(projectUpdatedAt(to) > 0, "目标项目应感知到待办被移入");

    const row = db.prepare("SELECT project_id FROM user_todos WHERE id = ?").get(tid) as {
      project_id: string;
    };
    assert.equal(row.project_id, to);
  });

  it("取消项目关联时只刷新源项目", () => {
    const uid = seedUser();
    const from = seedProject(uid, "源");
    const tid = seedTodo(uid, from);
    updateTodoFields(tid, { projectId: "" });
    assert.ok(projectUpdatedAt(from) > 0);
    const row = db.prepare("SELECT project_id FROM user_todos WHERE id = ?").get(tid) as {
      project_id: string;
    };
    assert.equal(row.project_id, "");
  });

  it("不关联任何项目时不触碰 projects 表", () => {
    const uid = seedUser();
    const other = seedProject(uid, "无关项目");
    const tid = seedTodo(uid);
    updateTodoFields(tid, { title: "y" });
    assert.equal(projectUpdatedAt(other), 0, "无关项目不应被刷新");
  });
});

describe("deleteProjectCascade", () => {
  it("删除项目及其子待办，不影响他人数据", () => {
    const uid = seedUser();
    const otherUid = seedUser();
    const pid = seedProject(uid);
    const t1 = seedTodo(uid, pid);
    const t2 = seedTodo(uid, pid);
    const foreign = seedTodo(otherUid, pid);

    deleteProjectCascade(pid, uid);

    assert.equal(db.prepare("SELECT id FROM projects WHERE id = ?").get(pid), undefined);
    assert.equal(db.prepare("SELECT id FROM user_todos WHERE id = ?").get(t1), undefined);
    assert.equal(db.prepare("SELECT id FROM user_todos WHERE id = ?").get(t2), undefined);
    assert.ok(
      db.prepare("SELECT id FROM user_todos WHERE id = ?").get(foreign),
      "他人挂在本项目下的待办不应被删除",
    );
  });

  it("删除不存在的项目不抛错", () => {
    const uid = seedUser();
    assert.doesNotThrow(() => deleteProjectCascade("no-such-project", uid));
  });
});

describe("syncProjectMilestones", () => {
  it("新增、更新与删除在一次调用内完成", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    const keep = seedTodo(uid, pid);
    const drop = seedTodo(uid, pid);

    syncProjectMilestones(pid, uid, [
      { id: keep, title: "保留并改名", priority: "high", dueDate: "2026-11-01" },
      { title: "全新任务", priority: "low" },
    ]);

    const kept = db
      .prepare("SELECT title, priority, due_date, sort_order FROM user_todos WHERE id = ?")
      .get(keep) as { title: string; priority: string; due_date: string; sort_order: number };
    assert.equal(kept.title, "保留并改名");
    assert.equal(kept.priority, "high");
    assert.equal(kept.due_date, "2026-11-01");
    assert.equal(kept.sort_order, 0);

    assert.equal(
      db.prepare("SELECT id FROM user_todos WHERE id = ?").get(drop),
      undefined,
      "未出现在入参中的旧任务应被删除",
    );

    const rows = db
      .prepare("SELECT title FROM user_todos WHERE project_id = ? ORDER BY sort_order ASC")
      .all(pid) as Array<{ title: string }>;
    assert.deepEqual(rows.map((r) => r.title), ["保留并改名", "全新任务"]);
  });

  it("标题为空的行被跳过并因此被清理", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    const t = seedTodo(uid, pid);

    syncProjectMilestones(pid, uid, [{ id: t, title: "   " }]);

    assert.equal(db.prepare("SELECT id FROM user_todos WHERE id = ?").get(t), undefined);
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM user_todos WHERE project_id = ?")
      .get(pid) as { c: number };
    assert.equal(count.c, 0);
  });

  it("优先级只接受 high/low，其余归为 medium", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    syncProjectMilestones(pid, uid, [
      { title: "A", priority: "high" },
      { title: "B", priority: "low" },
      { title: "C", priority: "urgent" },
      { title: "D" },
    ]);
    const rows = db
      .prepare("SELECT priority FROM user_todos WHERE project_id = ? ORDER BY sort_order ASC")
      .all(pid) as Array<{ priority: string }>;
    assert.deepEqual(rows.map((r) => r.priority), ["high", "low", "medium", "medium"]);
  });

  it("temp- 前缀的临时 id 会被替换为真实 id", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    syncProjectMilestones(pid, uid, [{ id: "temp-1", title: "新任务" }]);
    const rows = db
      .prepare("SELECT id FROM user_todos WHERE project_id = ?")
      .all(pid) as Array<{ id: string }>;
    assert.equal(rows.length, 1);
    assert.ok(!rows[0].id.startsWith("temp-"), `实际 id: ${rows[0].id}`);
    assert.ok(rows[0].id.startsWith("todo-"));
  });

  it("不改动其他项目的里程碑", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    const otherPid = seedProject(uid);
    const untouched = seedTodo(uid, otherPid);

    syncProjectMilestones(pid, uid, [{ title: "只属于本项目" }]);

    assert.ok(
      db.prepare("SELECT id FROM user_todos WHERE id = ?").get(untouched),
      "其他项目的任务不应被本项目的同步清理掉",
    );
  });

  it("空列表清空该项目全部里程碑", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    seedTodo(uid, pid);
    seedTodo(uid, pid);
    syncProjectMilestones(pid, uid, []);
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM user_todos WHERE project_id = ?")
      .get(pid) as { c: number };
    assert.equal(count.c, 0);
  });
});

describe("rolloverOverdueTodos", () => {
  function seedOverdue(userId: string, dueDate: string, sortOrder = 0): string {
    const tid = `todo-${Date.now()}-${seq++}`;
    db.prepare(
      `INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, created_at, sort_order)
       VALUES (?, ?, 'T', 'medium', 0, ?, '', ?, ?)`,
    ).run(tid, userId, dueDate, Date.now(), sortOrder);
    return tid;
  }
  function dueOf(id: string): string {
    return (
      db.prepare("SELECT due_date FROM user_todos WHERE id = ?").get(id) as {
        due_date: string;
      }
    ).due_date;
  }

  it("today 模式：全部过期待办顺延到今日", () => {
    const uid = seedUser();
    const a = seedOverdue(uid, "2026-01-01");
    const b = seedOverdue(uid, "2026-01-02");
    const r = rolloverOverdueTodos(uid, "2026-10-10", "today");
    assert.deepEqual(r, { count: 2, mode: "today" });
    assert.equal(dueOf(a), "2026-10-10");
    assert.equal(dueOf(b), "2026-10-10");
  });

  it("只顺延未完成且已过期的待办", () => {
    const uid = seedUser();
    const overdue = seedOverdue(uid, "2026-01-01");
    const future = seedOverdue(uid, "2099-01-01");
    const noDate = seedOverdue(uid, "");
    const done = seedOverdue(uid, "2026-01-01");
    db.prepare("UPDATE user_todos SET done = 1 WHERE id = ?").run(done);

    const r = rolloverOverdueTodos(uid, "2026-10-10", "today");

    assert.equal(r.count, 1);
    assert.equal(dueOf(overdue), "2026-10-10");
    assert.equal(dueOf(future), "2099-01-01", "未来待办不应被改动");
    assert.equal(dueOf(noDate), "", "无日期待办不应被改动");
    assert.equal(dueOf(done), "2026-01-01", "已完成待办不应被改动");
  });

  it("只处理本人待办", () => {
    const uid = seedUser();
    const other = seedUser();
    const mine = seedOverdue(uid, "2026-01-01");
    const theirs = seedOverdue(other, "2026-01-01");

    const r = rolloverOverdueTodos(uid, "2026-10-10", "today");

    assert.equal(r.count, 1);
    assert.equal(dueOf(mine), "2026-10-10");
    assert.equal(dueOf(theirs), "2026-01-01");
  });

  it("无过期待办时返回 0 且不抛错", () => {
    const uid = seedUser();
    assert.deepEqual(rolloverOverdueTodos(uid, "2026-10-10", "today"), {
      count: 0,
      mode: "today",
    });
  });

  it("week 模式：平摊到本周剩余天数，日期均不早于今日", () => {
    const uid = seedUser();
    const ids = [
      seedOverdue(uid, "2026-01-01", 0),
      seedOverdue(uid, "2026-01-02", 1),
      seedOverdue(uid, "2026-01-03", 2),
      seedOverdue(uid, "2026-01-04", 3),
      seedOverdue(uid, "2026-01-05", 4),
    ];
    const r = rolloverOverdueTodos(uid, "2026-10-10", "week");
    assert.equal(r.count, 5);
    assert.equal(r.mode, "week");

    for (const id of ids) {
      const d = dueOf(id);
      assert.ok(d >= "2026-10-10", `${id} 顺延后不应早于今日，实际 ${d}`);
      // 最远不超过本周日（10-10 是周六，故上限为 10-11）
      assert.ok(d <= "2026-10-11", `${id} 不应超出本周，实际 ${d}`);
    }
  });

  it("week 模式下计数与实际改动一致", () => {
    const uid = seedUser();
    seedOverdue(uid, "2026-01-01");
    seedOverdue(uid, "2026-01-02");
    const r = rolloverOverdueTodos(uid, "2026-10-10", "week");
    const stillOverdue = db
      .prepare(
        "SELECT COUNT(*) AS c FROM user_todos WHERE user_id = ? AND done = 0 AND due_date != '' AND due_date < ?",
      )
      .get(uid, "2026-10-10") as { c: number };
    assert.equal(r.count, 2);
    assert.equal(stillOverdue.c, 0, "顺延后不应再有过期待办");
  });
});

describe("createTodo", () => {
  it("插入待办并把 sort_order 排在当前最大值之后", () => {
    const uid = seedUser();
    const a = createTodo(uid, { title: "第一条" });
    const b = createTodo(uid, { title: "第二条" });
    const rows = db
      .prepare("SELECT id, sort_order FROM user_todos WHERE user_id = ? ORDER BY sort_order ASC")
      .all(uid) as Array<{ id: string; sort_order: number }>;
    assert.deepEqual(rows.map((r) => r.id), [a, b]);
    assert.equal(rows[0].sort_order, 0);
    assert.equal(rows[1].sort_order, 1);
  });

  it("字段归一化：标题 trim、日期截断、优先级白名单", () => {
    const uid = seedUser();
    const id = createTodo(uid, {
      title: "  标题  ",
      priority: "urgent",
      dueDate: "2026-10-12T09:00:00Z",
    });
    const row = db
      .prepare("SELECT title, priority, due_date, done FROM user_todos WHERE id = ?")
      .get(id) as { title: string; priority: string; due_date: string; done: number };
    assert.equal(row.title, "标题");
    assert.equal(row.priority, "medium", "未知优先级归为 medium");
    assert.equal(row.due_date, "2026-10-12");
    assert.equal(row.done, 0);
  });

  it("assigneeId 同时写入 assignee_id 与历史列 assigned_to", () => {
    const uid = seedUser();
    const id = createTodo(uid, { title: "T", assigneeId: "u-7", assigneeName: "某人" });
    const row = db
      .prepare("SELECT assignee_id, assigned_to, assignee_name FROM user_todos WHERE id = ?")
      .get(id) as { assignee_id: string; assigned_to: string; assignee_name: string };
    assert.equal(row.assignee_id, "u-7");
    assert.equal(row.assigned_to, "u-7");
    assert.equal(row.assignee_name, "某人");
  });

  it("关联项目时刷新该项目时间戳", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    createTodo(uid, { title: "T", projectId: pid });
    assert.ok(projectUpdatedAt(pid) > 0);
  });

  it("不关联项目时不触碰 projects 表", () => {
    const uid = seedUser();
    const other = seedProject(uid);
    createTodo(uid, { title: "T" });
    assert.equal(projectUpdatedAt(other), 0);
  });
});

describe("createProject", () => {
  it("创建项目并返回与 GET 一致的字段形状", () => {
    const uid = seedUser();
    const p = createProject(uid, { name: "项目", color: "#123456" });
    assert.ok(p.id.startsWith("proj-"));
    assert.equal(p.name, "项目");
    assert.equal(p.color, "#123456");
    assert.equal(p.statusColor, "#123456", "color 与 statusColor 应一致");
    assert.equal(p.sortOrder, 0);
  });

  it("statusColor 作为 color 的兼容别名", () => {
    const uid = seedUser();
    const p = createProject(uid, { name: "P", statusColor: "#ABCDEF" });
    assert.equal(p.color, "#ABCDEF");
  });

  it("缺省值：状态「进行中」、颜色 #00C776、url 空", () => {
    const uid = seedUser();
    const p = createProject(uid, { name: "P" });
    assert.equal(p.status, "进行中");
    assert.equal(p.color, "#00C776");
    assert.equal(p.url, "");
  });

  it("sort_order 递增", () => {
    const uid = seedUser();
    const a = createProject(uid, { name: "A" });
    const b = createProject(uid, { name: "B" });
    assert.equal(a.sortOrder, 0);
    assert.equal(b.sortOrder, 1);
  });

  it("可一并写入里程碑，且标题为空的行被跳过", () => {
    const uid = seedUser();
    const p = createProject(uid, {
      name: "带里程碑",
      todos: [
        { title: "阶段一", priority: "high", dueDate: "2026-11-01" },
        { title: "   " },
        { title: "阶段二", priority: "low" },
      ],
    });
    const rows = db
      .prepare("SELECT title, priority, due_date, sort_order FROM user_todos WHERE project_id = ? ORDER BY sort_order ASC")
      .all(p.id) as Array<{ title: string; priority: string; due_date: string; sort_order: number }>;
    assert.deepEqual(rows.map((r) => r.title), ["阶段一", "阶段二"]);
    assert.deepEqual(rows.map((r) => r.priority), ["high", "low"]);
    assert.equal(rows[0].due_date, "2026-11-01");
    // sort_order 取原数组下标，因此被跳过的空标题会在序列中留下空位（与原实现一致）
    assert.deepEqual(rows.map((r) => r.sort_order), [0, 2]);
  });

  it("未传 todos 时不产生里程碑", () => {
    const uid = seedUser();
    const p = createProject(uid, { name: "空项目" });
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM user_todos WHERE project_id = ?")
      .get(p.id) as { c: number };
    assert.equal(count.c, 0);
  });

  it("项目归属创建者", () => {
    const uid = seedUser();
    const p = createProject(uid, { name: "归属" });
    const row = db.prepare("SELECT user_id FROM projects WHERE id = ?").get(p.id) as {
      user_id: string;
    };
    assert.equal(row.user_id, uid);
  });
});

describe("updateProject", () => {
  it("更新字段并始终刷新 updated_at", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    updateProject(pid, uid, { name: "改名后", status: "维护中" });
    const row = db
      .prepare("SELECT name, status, updated_at FROM projects WHERE id = ?")
      .get(pid) as { name: string; status: string; updated_at: number };
    assert.equal(row.name, "改名后");
    assert.equal(row.status, "维护中");
    assert.ok(row.updated_at > 0);
  });

  it("不传字段时也刷新 updated_at（与原实现一致）", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    updateProject(pid, uid, {});
    assert.ok(projectUpdatedAt(pid) > 0);
  });

  it("statusColor 作为 color 的兼容别名", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    updateProject(pid, uid, { statusColor: "#ABCDEF" });
    const row = db.prepare("SELECT status_color FROM projects WHERE id = ?").get(pid) as {
      status_color: string;
    };
    assert.equal(row.status_color, "#ABCDEF");
  });

  it("只更新本人项目（user_id 条件生效）", () => {
    const uid = seedUser();
    const other = seedUser();
    const pid = seedProject(other);
    updateProject(pid, uid, { name: "篡改" });
    const row = db.prepare("SELECT name FROM projects WHERE id = ?").get(pid) as { name: string };
    assert.equal(row.name, "P", "他人调用不应改动");
  });

  it("可一并同步里程碑（增/改/删）", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    const keep = seedTodo(uid, pid);
    const drop = seedTodo(uid, pid);

    updateProject(pid, uid, {
      name: "带里程碑",
      todos: [
        { id: keep, title: "保留改名", priority: "high" },
        { title: "新增" },
      ],
    });

    const rows = db
      .prepare("SELECT title FROM user_todos WHERE project_id = ? ORDER BY sort_order ASC")
      .all(pid) as Array<{ title: string }>;
    assert.deepEqual(rows.map((r) => r.title), ["保留改名", "新增"]);
    assert.equal(db.prepare("SELECT id FROM user_todos WHERE id = ?").get(drop), undefined);
  });

  it("里程碑同步失败时项目字段一并回滚（原实现会留下半更新）", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    const before = db.prepare("SELECT name FROM projects WHERE id = ?").get(pid) as {
      name: string;
    };

    // 构造一个必然失败的里程碑同步：todos 不是数组时不会被同步，
    // 因此改用「传入非法元素」触发 —— 用 getter 抛错来模拟中途失败
    const poisoned = [
      { title: "正常" },
      Object.defineProperty({}, "title", {
        get() {
          throw new Error("boom");
        },
        enumerable: true,
      }),
    ];

    assert.throws(() => updateProject(pid, uid, { name: "不该保留", todos: poisoned as never }));

    const after = db.prepare("SELECT name FROM projects WHERE id = ?").get(pid) as {
      name: string;
    };
    assert.equal(after.name, before.name, "项目字段应随事务回滚");
    const count = db
      .prepare("SELECT COUNT(*) AS c FROM user_todos WHERE project_id = ?")
      .get(pid) as { c: number };
    assert.equal(count.c, 0, "已写入的里程碑也应回滚");
  });

  it("不传 todos 时不动里程碑", () => {
    const uid = seedUser();
    const pid = seedProject(uid);
    const keep = seedTodo(uid, pid);
    updateProject(pid, uid, { name: "只改名字" });
    assert.ok(db.prepare("SELECT id FROM user_todos WHERE id = ?").get(keep));
  });
});
