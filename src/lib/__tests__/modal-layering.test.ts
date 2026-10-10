import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setupDom, teardownDom, loadTsx } from "./helpers/tsx-loader.ts";
import { render, queryAll, cleanup } from "./helpers/render.ts";
/**
 * 弹窗层级回归。
 *
 * 背景：`Modal` 与手动写的弹窗遮罩此前都是 `z-50`。同层级下**后渲染者覆盖
 * 先渲染者**，因此「在弹窗 A 内打开确认框 B」时，只要 A 的 JSX 在 B 之后，
 * 确认框就会被 A 盖住、用户看不到也点不到。
 *
 * 具体缺陷：Pro Tab 的 `ConfirmDialog` 渲染在 `<AdminProBackupListModal>` 之前
 * （两者同为 z-50），在云端快照列表里点「🔄 一键还原」弹出的确认框被列表盖住。
 *
 * 这里固定住机制本身：确认框必须以更高层级渲染，从而浮在任何普通弹窗之上。
 */

let Modal: never;
let ConfirmDialog: never;
let BackupListModal: never;

before(async () => {
  await setupDom();
  Modal = (await loadTsx("src/components/modal.tsx")).default as never;
  ConfirmDialog = (await loadTsx("src/components/confirm-dialog.tsx")).default as never;
  BackupListModal = (
    await loadTsx("src/app/(app)/admin/components/admin-pro-backup-list-modal.tsx")
  ).default as never;
});
after(() => teardownDom());
beforeEach(() => cleanup());

/** 取已挂载内容里带 z-* 类名的遮罩层，按 DOM 顺序返回其 z 值 */
function overlayZs(): string[] {
  const out: string[] = [];
  for (const n of queryAll("div")) {
    const cls = n.className || "";
    if (typeof cls === "string" && cls.includes("fixed") && cls.includes("inset-0")) {
      const m = cls.match(/(?:^|\s)(?:z-\[(\d+)\]|z-(\d+))(?:$|\s)/);
      if (m) out.push(m[1] ?? m[2] ?? "");
    }
  }
  return out;
}

/** 单个遮罩的 z 值（首个） */
function overlayZ(): string | null {
  return overlayZs()[0] ?? null;
}

describe("Modal 层级", () => {
  it("默认渲染为 z-50（与既有弹窗平级）", () => {
    render(Modal, { open: true, title: "t", onClose: () => {}, children: null });
    assert.equal(overlayZ(), "50");
  });

  it("elevated 渲染为更高层级", () => {
    render(Modal, {
      open: true,
      title: "t",
      onClose: () => {},
      children: null,
      elevated: true,
    });
    const z = Number(overlayZ());
    assert.ok(Number.isFinite(z), "应能解析出 z 值");
    assert.ok(z > 50, `elevated 的层级应高于普通弹窗的 50，实际 ${z}`);
  });

  it("open 为 false 时不渲染", () => {
    render(Modal, { open: false, title: "t", onClose: () => {}, children: null });
    assert.equal(overlayZ(), null);
  });
});

describe("ConfirmDialog 层级", () => {
  it("以高于普通弹窗的层级渲染（可由弹窗内部触发）", () => {
    render(ConfirmDialog, {
      open: true,
      title: "从云端还原",
      message: "确定还原？",
      onConfirm: () => {},
      onClose: () => {},
    });
    const z = Number(overlayZ());
    assert.ok(Number.isFinite(z), "应能解析出 z 值");
    assert.ok(
      z > 50,
      `确认框需浮在触发它的弹窗（z-50）之上，否则会被盖住无法点击；实际 z=${z}`,
    );
  });

  it("未打开时不渲染任何遮罩", () => {
    render(ConfirmDialog, {
      open: false,
      title: "t",
      message: "m",
      onConfirm: () => {},
      onClose: () => {},
    });
    assert.equal(overlayZ(), null);
  });

  it("复现线上场景：与云端快照列表同时打开时，确认框必须在其之上", () => {
    // 复现缺陷的确切条件 —— 两者是兄弟节点，且列表**后**渲染，
    // 层级相同时后者会盖住前者：
    //   <ConfirmDialog {...confirmDialog.dialogProps} />     ← 先
    //   {storage.showBackupListModal && <AdminProBackupListModal … />}  ← 后
    // 实际触发路径：列表里点「🔄 一键还原」→ restoreFromCloud → confirm()。
    // 修复前两者同为 z-50，确认框被列表盖住，用户看不到也点不到。
    render(BackupListModal, {
      loading: false,
      backups: [
        { name: "navelix-2026-10-10.db", size: 4096, lastModified: "2026-10-10T00:00:00.000Z" },
      ],
      restoringFileName: null,
      onRestore: () => {},
      onClose: () => {},
    });
    render(ConfirmDialog, {
      open: true,
      title: "从云端还原",
      message: "确定还原？",
      onConfirm: () => {},
      onClose: () => {},
    });

    const zs = overlayZs();
    assert.equal(zs.length, 2, `应同时存在列表与确认框两个遮罩，实际 ${zs.length} 个`);
    const [listZ, confirmZ] = zs.map(Number);
    assert.ok(
      confirmZ > listZ,
      `确认框必须在列表之上（列表 z=${listZ}，确认框 z=${confirmZ}），否则会被盖住无法操作`,
    );
  });
});
