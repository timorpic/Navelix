import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getUserData } from "@/lib/user-data";
import { NavelixProvider } from "@/components/navelix-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // SSR 预取：在服务端获取用户数据，直接注入客户端 Provider，
  // 避免首屏白屏等待（由 useEffect 触发）
  const initialData = getUserData(user.id);

  return (
    <NavelixProvider initialData={initialData}>
      {children}
    </NavelixProvider>
  );
}
