import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { getUserData } from "@/lib/user-data";
import { db } from "@/lib/db";
import { NavelixProvider } from "@/components/navelix-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, cookieStore] = await Promise.all([
    getSessionUser(),
    cookies(),
  ]);

  const leftCookie = cookieStore.get("navelix_sidebar_left")?.value;
  const rightCookie = cookieStore.get("navelix_sidebar_right")?.value;
  const themeCookie = cookieStore.get("navelix_theme")?.value;

  if (!user) {
    const primaryUser = db
      .prepare(
        "SELECT id FROM users ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC LIMIT 1"
      )
      .get() as { id: string } | undefined;

    if (!primaryUser) {
      redirect("/register");
    }

    const configRow = db
      .prepare("SELECT allow_public_access FROM user_configs WHERE user_id = ?")
      .get(primaryUser.id) as { allow_public_access?: number } | undefined;

    // 系统默认不开放访客公开访问（私有模式）：只有管理员显式设置为 1 时才允许访客公开浏览，否则强制跳转登录页
    if (!configRow || configRow.allow_public_access !== 1) {
      redirect("/login");
    }

    const initialData = getUserData(primaryUser.id);
    if (themeCookie === "light" || themeCookie === "dark" || themeCookie === "system") {
      initialData.config.theme = themeCookie;
    }
    if (leftCookie !== undefined) {
      initialData.config.sidebarDefaultState =
        leftCookie === "1" || leftCookie === "true" ? "collapsed" : "expanded";
    }
    if (rightCookie !== undefined) {
      initialData.config.sidebarRightDefaultState =
        rightCookie === "1" || rightCookie === "true" ? "collapsed" : "expanded";
    }
    return (
      <NavelixProvider initialData={initialData}>
        {children}
      </NavelixProvider>
    );
  }

  // SSR 预取：在服务端获取用户数据，直接注入客户端 Provider，
  // 避免首屏白屏等待（由 useEffect 触发）
  const initialData = getUserData(user.id);
  if (themeCookie === "light" || themeCookie === "dark" || themeCookie === "system") {
    initialData.config.theme = themeCookie;
  }
  if (leftCookie !== undefined) {
    initialData.config.sidebarDefaultState =
      leftCookie === "1" || leftCookie === "true" ? "collapsed" : "expanded";
  }
  if (rightCookie !== undefined) {
    initialData.config.sidebarRightDefaultState =
      rightCookie === "1" || rightCookie === "true" ? "collapsed" : "expanded";
  }

  return (
    <NavelixProvider initialData={initialData}>
      {children}
    </NavelixProvider>
  );
}
