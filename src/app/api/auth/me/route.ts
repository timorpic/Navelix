import { localizedJson } from "@/lib/localized-json";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }
  return localizedJson({ user });
}
