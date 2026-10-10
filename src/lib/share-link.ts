"use client";

/**
 * 免登录分享链接的获取与复制。
 *
 * 此前这段逻辑在 4 个组件里各写了一遍（`page.tsx`、`category-columns.tsx`、
 * `sidebar.tsx`、`add-category-modal.tsx`），且文案已经漂移出 3 种写法。
 * 统一到此处后，请求、剪贴板写入与提示文案只有一个来源。
 */

export type ShareTargetType = "category" | "project";

export interface CopyShareLinkResult {
  ok: boolean;
  /** 成功时为完整分享链接，失败时为面向用户的错误文案 */
  message: string;
}

/**
 * 申请分享 token 并写入剪贴板。
 *
 * 不直接弹提示，而是把文案交给调用方 —— 各调用点的展示方式不同
 * （Toast、内联横幅），统一在这里弹窗会改变既有交互。
 *
 * @param label 目标名称，用于成功文案（如「工作台」）
 */
export async function copyShareLink(
  type: ShareTargetType,
  id: string,
  label: string,
): Promise<CopyShareLinkResult> {
  try {
    const res = await fetch("/api/share/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    if (!res.ok) throw new Error("获取分享链接失败");
    const data = await res.json();
    const fullUrl = `${window.location.origin}${data.sharePath}`;
    await navigator.clipboard.writeText(fullUrl);
    return {
      ok: true,
      message: `已复制「${label}」免登录分享链接至剪贴板！可以直接发送给朋友或同事查看。`,
    };
  } catch {
    return { ok: false, message: "生成分享链接失败，请重试" };
  }
}
