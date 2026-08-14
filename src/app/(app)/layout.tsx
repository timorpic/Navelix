import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getUserData } from "@/lib/user-data";
import { db } from "@/lib/db";
import { NavelixProvider } from "@/components/navelix-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    // 检查库内是否有用户存在
    const primaryUser = db
      .prepare("SELECT id FROM users ORDER BY created_at ASC LIMIT 1")
      .get() as { id: string } | undefined;

    if (!primaryUser) {
      redirect("/register");
    }

    const configRow = db
      .prepare("SELECT allow_public_access FROM user_configs WHERE user_id = ?")
      .get(primaryUser.id) as { allow_public_access?: number } | undefined;

    // 如果管理员关闭了未登录访客访问（私有模式），强制跳转登录页
    if (configRow && configRow.allow_public_access === 0) {
      redirect("/login");
    }

    const initialData = getUserData(primaryUser.id);
    return (
      <NavelixProvider initialData={initialData}>
        {children}
      </NavelixProvider>
    );
  }

  // SSR 预取：在服务端获取用户数据，直接注入客户端 Provider，
  // 避免首屏白屏等待（由 useEffect 触发）
  const initialData = getUserData(user.id);

  return (
    <NavelixProvider initialData={initialData}>
      {children}
    </NavelixProvider>
  );
}
