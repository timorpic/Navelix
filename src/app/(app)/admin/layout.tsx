import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

// Multi-tenant Admin Layout Guard: Requires authentication for user's personal admin console
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  return <>{children}</>;
}
