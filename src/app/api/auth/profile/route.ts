import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { getSessionUser, toPublicUser } from "@/lib/auth";
import { getUserRow, updateProfile } from "@/lib/profile";

// PATCH /api/auth/profile - 当前登录用户自助修改个人资料（头像、显示名称、个人密码）
async function PATCHHandler(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const result = updateProfile(user.id, body ?? {});

  if (!result.ok) {
    // 「账号不存在」是 404，其余是校验失败 400
    const status = result.error === "用户账号不存在" ? 404 : 400;
    return localizedJson({ error: result.error }, { status });
  }

  const updatedRow = getUserRow(user.id);
  return localizedJson({
    success: true,
    user: updatedRow ? toPublicUser(updatedRow) : undefined,
    message: result.passwordChanged ? "个人资料与密码已成功更新" : "个人资料更新成功",
  });
}

export const PATCH = withRequestLogging("/api/auth/profile", PATCHHandler);
