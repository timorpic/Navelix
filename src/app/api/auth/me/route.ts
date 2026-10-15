import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { getSessionUser } from "@/lib/auth";

async function GETHandler() {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }
  return localizedJson({ user });
}

export const GET = withRequestLogging("/api/auth/me", GETHandler);
